// server.js

// 1. 환경 변수 로드
require('dotenv').config();

// 2. 패키지 로드
const express = require('express');
const mysql = require('mysql2');
const app = express();
const port = 4000;
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// ✅ JSON 파싱
app.use(express.json());

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));

// ✅ MySQL Pool
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

// ✅ 연결 테스트
db.getConnection((err, conn) => {
    if (err) {
        console.error('MySQL 연결 실패:', err.message);
        return;
    }
    console.log('✅ MySQL 연결 성공!');
    conn.release();
});

app.get('/', (req, res) => {
    res.send('API Server is running.');
});


// ✅ JWT 인증 미들웨어
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];


    if (!token) {
        return res.status(401).json({ error: '인증 토큰이 누락되었습니다.' });
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: '토큰이 유효하지 않거나 만료되었습니다.' });
        }

        req.userId = user.id; // ✅ user_id가 들어있음
        next();
    });
};


// ✅ 회원가입 라우트
app.post('/api/auth/signup', (req, res) => {
    const { email, password, phonenumber, nickname } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: '필수 정보를 입력해주세요.' });
    }

    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            console.error('Hash Error:', err);
            return res.status(500).json({ error: '비밀번호 해싱 오류' });
        }

        const insertQuery = `
            INSERT INTO user (user_id, password, nickname, phonenumber, email)
            VALUES (?, ?, ?, ?, ?)
        `;

        db.query(insertQuery, [email, hashedPassword, nickname, phonenumber, email], (err) => {
            if (err) {
                if (err.errno === 1062) {
                    return res.status(409).json({ error: '이미 존재하는 사용자입니다.' });
                }
                console.error('Signup DB Error:', err);
                return res.status(500).json({ error: '회원가입 중 DB 오류' });
            }

            // ✅ 실제 JWT 생성
            const token = jwt.sign(
                { id: email }, 
                process.env.JWT_SECRET, 
                { expiresIn: '1h' }
            );

            res.status(201).json({
                message: '회원가입 성공',
                token: token
            });
        });
    });
});

// ✅ 즐겨찾기
app.post('/api/favorites', authenticateToken, (req, res) => {
    const userId = req.userId;   // JWT에서 추출한 user_id
    const { station_id } = req.body;

    if (!station_id) {
        return res.status(400).json({ error: "station_id가 필요합니다." });
    }

    const query = `
        INSERT INTO bookmark (user_id, station_id)
        VALUES (?, ?)
    `;

    db.query(query, [userId, station_id], (err) => {
        if (err) {
            if (err.errno === 1062) {
                return res.status(409).json({ error: "이미 즐겨찾기에 추가된 대여소입니다." });
            }
            console.error("즐겨찾기 추가 DB 오류:", err);
            return res.status(500).json({ error: "즐겨찾기 추가 중 오류 발생" });
        }

        res.json({ message: "즐겨찾기에 추가되었습니다." });
    });
});


// ✅ 즐겨찾기 정보 가져오기
app.get('/api/favorites', authenticateToken, (req, res) => {
    const userId = req.userId;

    const query = `
        SELECT 
            b.station_id,
            s.name AS station_name,
            s.lat AS latitude,
            s.lng AS longitude
        FROM bookmark b
        JOIN station s ON b.station_id = s.station_id
        WHERE b.user_id = ?
    `;

    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error("즐겨찾기 조회 오류:", err);
            return res.status(500).json({ error: "즐겨찾기 조회 실패" });
        }
        res.json(results);
    });
});

// ✅ 로그인 라우트
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
    }

    const query = `
        SELECT user_id, password
        FROM user
        WHERE user_id = ?
    `;

    db.query(query, [email], async (err, results) => {
        if (err) {
            console.error('Login DB Error:', err.message);
            return res.status(500).json({ error: '로그인 DB 오류' });
        }

        if (results.length === 0) {
            return res.status(401).json({ error: '존재하지 않는 계정입니다.' });
        }

        const user = results[0];

        // ✅ 비밀번호 비교
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
        }

        // ✅ 정상 JWT 발급 (user.user_id 사용)
        const token = jwt.sign(
            { id: user.user_id }, 
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({
            message: '로그인 성공',
            token: token
        });
    });
});


// ✅ 사용자 정보 조회
app.get('/api/user', authenticateToken, (req, res) => {
    const userId = req.userId;

    const query = `
        SELECT email, nickname, phonenumber
        FROM user
        WHERE user_id = ?
    `;

    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('User Fetch Error:', err);
            return res.status(500).json({ error: '사용자 조회 오류' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        const user = results[0];

        res.json({
            email: user.email,
            nickname: user.nickname || '익명 사용자',
            phonenumber: user.phonenumber
        });
    });
});


// ✅ 대여소 조회
app.get('/api/stations', (req, res) => {
    const region = req.query.region; // 쿼리 파라미터에서 region 값을 추출
    
    let query = 'SELECT * FROM station';
    let params = [];

    // region 값이 있을 경우 WHERE 절 추가
    if (region) {
        //  일치하는 지역을 찾습니다.
        query += ' WHERE region = ?';
        params.push(region);
    }
    
    // ✅ 쿼리 실행
    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Station Fetch DB Error:', err); 
            return res.status(500).json({ error: 'DB 조회 오류' });
        }
         res.json(results);
    });
});

// ✅ 즐겨찾기 삭제 (DELETE)
app.delete('/api/favorites', authenticateToken, (req, res) => {
    const userId = req.userId; // JWT에서 추출한 user_id
    // DELETE 요청은 쿼리 파라미터를 이용해서
    const station_id = req.query.station_id ? req.query.station_id.trim() : null;
    // 1. station_id 누락 여부 확인 (클라이언트 측 오류 방지)
    if (!station_id) {
        return res.status(400).json({ error: "station_id가 필요합니다." });
    }

    const deleteQuery = `
        DELETE FROM bookmark 
        WHERE user_id = ? AND station_id = ?
    `;

    // 2. DB 삭제 쿼리 실행
    db.query(deleteQuery, [userId, station_id], (err, result) => {
        if (err) {
            console.error("즐겨찾기 삭제 DB 오류:", err);
            return res.status(500).json({ error: "즐겨찾기 삭제 중 오류 발생" });
        }

        // 3. 삭제 결과 확인
        if (result.affectedRows === 0) {
            // 삭제할 항목이 없는 경우
            return res.status(404).json({ error: "해당 즐겨찾기 항목을 찾을 수 없습니다." });
        }

        // 4. 성공 응답
        res.json({ message: "즐겨찾기에서 삭제되었습니다." });

        
    });
});


// ✅ 서버 실행
app.listen(port, () => {
    console.log(`🚀 서버가 http://localhost:${port} 에서 실행 중`);
});
