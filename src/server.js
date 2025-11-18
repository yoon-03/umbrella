// server.js
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
const port = 4000;

// 미들웨어
app.use(express.json());
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));

// DB Pool 설정
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// DB 연결 확인
db.getConnection((err, conn) => {
    if (err) console.error('MySQL 연결 실패:', err.message);
    else {
        console.log('✅ MySQL 연결 성공!');
        conn.release();
    }
});

// --- 미들웨어: JWT 인증 ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: '토큰 누락' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: '토큰 만료/유효하지 않음' });
        req.userId = user.id;
        next();
    });
};

// --- 1. 인증 (Auth) ---

// 회원가입
app.post('/api/auth/signup', (req, res) => {
    const { email, password, phonenumber, nickname } = req.body;
    if (!email || !password) return res.status(400).json({ error: '필수 정보 누락' });

    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) return res.status(500).json({ error: '암호화 오류' });

        const query = `INSERT INTO user (user_id, password, nickname, phonenumber, email) VALUES (?, ?, ?, ?, ?)`;
        db.query(query, [email, hashedPassword, nickname, phonenumber, email], (err) => {
            if (err) {
                if (err.errno === 1062) return res.status(409).json({ error: '이미 존재하는 ID' });
                return res.status(500).json({ error: 'DB 오류' });
            }
            const token = jwt.sign({ id: email }, process.env.JWT_SECRET, { expiresIn: '1h' });
            res.status(201).json({ message: '회원가입 성공', token });
        });
    });
});

// 로그인
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    db.query(`SELECT user_id, password FROM user WHERE user_id = ?`, [email], async (err, results) => {
        if (err) return res.status(500).json({ error: 'DB 오류' });
        if (results.length === 0) return res.status(401).json({ error: '계정 없음' });

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: '비밀번호 불일치' });

        const token = jwt.sign({ id: user.user_id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: '로그인 성공', token });
    });
});

// --- 2. 사용자 및 대여소 (User & Station) ---

// 사용자 정보 조회
app.get('/api/user', authenticateToken, (req, res) => {
    const query = `
        SELECT u.email, u.nickname, u.phonenumber,
        (SELECT umbrella_id FROM umbrella_rental_service 
         WHERE user_id = u.user_id AND return_time IS NULL 
         ORDER BY rent_time DESC LIMIT 1) AS current_rental_id
        FROM user u WHERE u.user_id = ?
    `;
    db.query(query, [req.userId], (err, results) => {
        if (err) return res.status(500).json({ error: 'DB 오류' });
        if (results.length === 0) return res.status(404).json({ error: '사용자 없음' });
        res.json(results[0]);
    });
});

// 대여소 목록 조회 (지역 검색 포함)
app.get('/api/stations', (req, res) => {
    const region = req.query.region;
    let query = 'SELECT * FROM station';
    let params = [];
    if (region) {
        query += ' WHERE region = ?';
        params.push(region);
    }
    db.query(query, params, (err, results) => {
        if (err) return res.status(500).json({ error: 'DB 오류' });
        res.json(results);
    });
});

// --- 3. 즐겨찾기 (Favorites) ---

app.post('/api/favorites', authenticateToken, (req, res) => {
    const { station_id } = req.body;
    db.query(`INSERT INTO bookmark (user_id, station_id) VALUES (?, ?)`, [req.userId, station_id], (err) => {
        if (err) {
            if (err.errno === 1062) return res.status(409).json({ error: '이미 추가됨' });
            return res.status(500).json({ error: 'DB 오류' });
        }
        res.json({ message: '추가됨' });
    });
});

app.get('/api/favorites', authenticateToken, (req, res) => {
    const query = `
        SELECT b.station_id, s.name AS station_name, s.lat AS latitude, s.lng AS longitude
        FROM bookmark b JOIN station s ON b.station_id = s.station_id
        WHERE b.user_id = ?
    `;
    db.query(query, [req.userId], (err, results) => {
        if (err) return res.status(500).json({ error: 'DB 오류' });
        res.json(results);
    });
});

app.delete('/api/favorites', authenticateToken, (req, res) => {
    const station_id = req.query.station_id;
    db.query(`DELETE FROM bookmark WHERE user_id = ? AND station_id = ?`, [req.userId, station_id], (err, result) => {
        if (err) return res.status(500).json({ error: 'DB 오류' });
        res.json({ message: '삭제됨' });
    });
});

// --- 4. 대여 및 반납 (Rental - Transaction) ---

// 대여 가능한 우산 목록
app.get('/api/stations/:station_id/umbrella', authenticateToken, (req, res) => {
    db.query(`SELECT umbrella_id, status FROM umbrella WHERE station_id = ? AND status = 'available'`, 
    [req.params.station_id], (err, results) => {
        if (err) return res.status(500).json({ error: 'DB 오류' });
        res.json(results);
    });
});

// ✅ 우산 대여 (Async Transaction)
app.post('/api/rental/rent', authenticateToken, async (req, res) => {
    const { station_id, umbrella_id } = req.body;
    if (!station_id || !umbrella_id) return res.status(400).json({ error: '정보 누락' });

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // 1. 상태 확인
        const [check] = await connection.query(
            `SELECT status FROM umbrella WHERE umbrella_id = ? FOR UPDATE`, [umbrella_id]
        );
        if (check.length === 0 || check[0].status !== 'available') {
            throw new Error('대여 불가능한 우산입니다.');
        }

        // 2. 우산 업데이트 (위치: NULL, 상태: rented)
        await connection.query(
            `UPDATE umbrella SET status = 'rented', station_id = NULL, last_user_id = ? WHERE umbrella_id = ?`,
            [req.userId, umbrella_id]
        );

        // 3. 이력 생성
        await connection.query(
            `INSERT INTO umbrella_rental_service (user_id, station_id, umbrella_id, rent_time) VALUES (?, ?, ?, NOW())`,
            [req.userId, station_id, umbrella_id]
        );

        await connection.commit();
        res.json({ message: '대여 성공' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Rent Error:', error.message);
        res.status(400).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// ✅ 우산 반납 (Async Transaction + 강제 반납 로직)
app.post('/api/rental/return', authenticateToken, async (req, res) => {
    const { station_id, umbrella_id } = req.body;
    if (!station_id || !umbrella_id) return res.status(400).json({ error: '정보 누락' });

    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();

        // 1. 이력 확인 (가장 최근 대여 기록)
        const [history] = await connection.query(
            `SELECT rent_id FROM umbrella_rental_service 
             WHERE umbrella_id = ? AND return_time IS NULL 
             ORDER BY rent_time DESC LIMIT 1 FOR UPDATE`,
            [umbrella_id]
        );

        let rentId = null;
        if (history.length > 0) {
            rentId = history[0].rent_id;
            // 이력 업데이트 (반납 처리)
            await connection.query(
                `UPDATE umbrella_rental_service SET return_time = NOW(), station_id = ? WHERE rent_id = ?`,
                [station_id, rentId]
            );
        } else {
            console.log("⚠️ 대여 기록 누락됨. 우산 상태 강제 변경 시도.");
        }

        // 2. 우산 상태 확인 및 업데이트
        const [umbrella] = await connection.query(`SELECT status FROM umbrella WHERE umbrella_id = ?`, [umbrella_id]);
        
        // 이미 반납된 상태이고, 이력도 없으면 진짜 에러
        if (umbrella[0].status === 'available' && !rentId) {
            throw new Error('이미 반납된 우산입니다.');
        }

        // 우산 업데이트 (위치: 반납소, 상태: available)
        await connection.query(
            `UPDATE umbrella SET status = 'available', station_id = ? WHERE umbrella_id = ?`,
            [station_id, umbrella_id]
        );

        await connection.commit();
        res.json({ message: '반납 성공' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Return Error:', error.message);
        res.status(400).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});
