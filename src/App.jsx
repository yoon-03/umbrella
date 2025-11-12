import React, { useState, useEffect } from 'react';
import './App.css'; 
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; 
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

import { FaPlus, FaStar, FaLock, FaUser, FaGoogle, FaHome, FaQrcode, FaQrcode as FaGrid } from 'react-icons/fa'; // FaQrcode를 FaGrid로 별칭 지정 (아이콘 구분을 위해)

// --- 백엔드 설정 ---
const BACKEND_URL = 'http://localhost:5000';
// -----------------

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
});
L.Marker.prototype.options.icon = DefaultIcon;

// 예시 대여소 데이터
const stations = [
  { name: '미추홀구 대여소', position: [37.45, 126.65] },
  { name: '강남역 대여소', position: [37.498, 127.02] },
  { name: '신도림역 대여소', position: [37.508, 126.88] },
];

const MapComponent = () => {
  // 지도 및 탭 상태
  const [mapCenter, setMapCenter] = useState(stations[0].position);
  const [activeTab, setActiveTab] = useState('map'); // 'map', 'my', 'favorites', 'rental'
  const [favorites, setFavorites] = useState([]);

  // --- JWT 인증 상태 ---
  const [userToken, setUserToken] = useState(localStorage.getItem('userToken'));
  const [userInfo, setUserInfo] = useState(null); 
  const isLoggedIn = !!userToken;
  
  // 인증 폼 상태
  const [isSignup, setIsSignup] = useState(false); 
  const [loginForm, setLoginForm] = useState({ 
    email: '',
    password: '',
    passwordConfirm: '',
    phone: '',
    emailPrefix: '',
    emailDomain: 'gmail.com',
    isTwoFactorEnabled: false
  });
  const [authError, setAuthError] = useState('');
  
  // 컴포넌트 마운트 및 토큰 변경 시 사용자 정보 및 즐겨찾기 가져오기
  useEffect(() => {
    if (userToken) {
      fetchUserInfo();
      fetchFavorites();
    } else {
      setUserInfo(null);
      setFavorites([]);
    }
  }, [userToken]);

  // --- API 통신 함수 ---

  // 사용자 정보 가져오기
  const fetchUserInfo = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/user`, {
        headers: { 'Authorization': `Bearer ${userToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUserInfo(data);
      } else {
        handleLogout(); // 토큰 만료 등 오류 시 로그아웃
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      handleLogout();
    }
  };

  // 즐겨찾기 목록 가져오기
  const fetchFavorites = async () => {
      if (!userToken) return;
      try {
        const response = await fetch(`${BACKEND_URL}/api/favorites`, {
          headers: { 'Authorization': `Bearer ${userToken}` },
        });
        if (response.ok) {
          const data = await response.json();
          // DB에서 가져온 데이터를 React state 형식에 맞게 변환
          const formattedFavorites = data.map(fav => ({
              name: fav.station_name, 
              position: [fav.latitude, fav.longitude]
          }));
          setFavorites(formattedFavorites);
        } else if (response.status !== 401) {
          console.error('Failed to fetch favorites');
        }
      } catch (error) {
        console.error('Fetch Favorites Error:', error);
      }
  };

  // 로그인 및 회원가입 처리
  const handleAuth = async (isSignupMode) => {
    setAuthError('');
    const endpoint = isSignupMode ? '/api/auth/signup' : '/api/auth/login';
    let payload = loginForm; // 기본값은 loginForm

    if (isSignupMode) {
      // 회원가입 유효성 검사
      if (loginForm.password.length < 6) {
        return setAuthError('비밀번호는 6자 이상이어야 합니다.');
      }
      if (loginForm.password !== loginForm.passwordConfirm) {
        return setAuthError('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      }

      // 이메일 구성 및 유효성 확인
      const finalEmail = `${loginForm.emailPrefix}@${loginForm.emailDomain}`;
      if (!loginForm.emailPrefix || !loginForm.emailDomain || !finalEmail.includes('@')) {
        return setAuthError('이메일 아이디와 도메인을 정확히 입력해주세요.');
      }

      // 핸드폰 번호 확인 (10~11자리 숫자)
      const phoneRegex = /^\d{10,11}$/;
      if (!phoneRegex.test(loginForm.phone)) {
        return setAuthError('유효한 핸드폰 번호(10~11자리 숫자)를 입력해주세요.');
      }

      // 회원가입 페이로드 구성
      payload = {
        email: finalEmail,
        password: loginForm.password,
        phone: loginForm.phone,
        isTwoFactorEnabled: loginForm.isTwoFactorEnabled,
      };
    }

    try {
      const response = await fetch(BACKEND_URL + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isSignupMode ? payload : {email: loginForm.email, password: loginForm.password}), // 로그인 시는 간단한 페이로드 사용
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('userToken', data.token);
        setUserToken(data.token);
        const initialFormState = { email: '', password: '', passwordConfirm: '', phone: '', emailPrefix: '', emailDomain: 'gmail.com', isTwoFactorEnabled: false }; 
        setLoginForm(initialFormState);
        setIsSignup(false);
        setAuthError(isSignupMode ? '회원가입 성공!' : '로그인 성공!');
        alert(isSignupMode ? '회원가입이 완료되었습니다.' : '로그인 되었습니다.');
      } else {
        setAuthError(data.error || '인증 실패');
      }
    } catch (error) {
      console.error('Network or API Error:', error);
      setAuthError('서버에 연결할 수 없습니다. Node.js 서버가 실행 중인지 확인하세요.');
    }
  };
  
  // 로그아웃 처리
  const handleLogout = () => {
      localStorage.removeItem('userToken');
      setUserToken(null);
      setUserInfo(null);
      setAuthError('로그아웃되었습니다.');
      alert('로그아웃되었습니다.');
  };

  // 로그인 필요 시 MY 탭으로 이동시키고 메시지를 표시하는 함수
  const handleAuthRedirect = () => {
    setAuthError('대여 및 반납은 로그인 후 이용 가능합니다.');
    setActiveTab('my');
  };

  // 입력 필드 변경 핸들러
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    setLoginForm(prevForm => ({ 
      ...prevForm,
      [name]: type === 'checkbox' ? checked : value // 타입에 따라 value 또는 checked 사용 
    }));
    setAuthError('');
  };
  
  // 소셜 로그인 목업
  const handleSocialLogin = (providerName) => {
      alert(`소셜 로그인: ${providerName} 연동을 위해서는 백엔드 서버에서 OAuth 처리가 필요합니다.`);
  };

  const EmailInputFields = () => (
    <div className="email-split-container">
      <input
        type="text"
        name="emailPrefix"
        placeholder="아이디"
        value={loginForm.emailPrefix}
        onChange={handleInputChange}
        className="login-input"
        style={{ width: '45%', marginRight: '10px' }}
      />
      <span style={{ marginRight: '10px', color: '#555' }}>@</span>
      <input
        type="text"
        name="emailDomain"
        placeholder="gmail.com"
        value={loginForm.emailDomain}
        onChange={handleInputChange}
        className="login-input"
        style={{ width: 'calc(55% - 20px)' }}
      />
    </div>
  )
  
  // 즐겨찾기 추가 함수 (DB 연동)
  const handleAddFavorite = async (station) => {
    if (!isLoggedIn) {
        alert("즐겨찾기 추가는 로그인 후 이용 가능합니다.");
        return;
    }
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/favorites`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify({
                stationName: station.name,
                position: station.position
            }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert(data.message);
            fetchFavorites(); // 목록 새로고침
        } else {
            alert(`추가 실패: ${data.error}`);
        }
    } catch (error) {
        alert("서버 연결 오류로 즐겨찾기를 추가할 수 없습니다.");
    }
  };

  // 즐겨찾기 목록 항목 클릭 시 지도 위치로 이동하는 함수
  const handleGoToFavorite = (position) => {
    setMapCenter(position); 
    setActiveTab('map'); 
  };
  
  // 탭 전환 핸들러 (토글 로직 적용)
  const handleTabToggle = (tabName) => {
      // 중앙 버튼의 'rental' 탭 전환과 충돌하지 않도록 처리
      if (activeTab === tabName) {
          setActiveTab('map'); // 현재 탭을 다시 누르면 지도로 돌아감
      } else {
          setActiveTab(tabName); // 다른 탭으로 이동
      }
  };
  
  // 중앙 버튼 렌더링 시 map일 때만 rental 탭으로 이동, 나머지는 map으로 복귀
  const handleCenterButtonClick = () => {
    if (activeTab === 'map') {
      if (isLoggedIn) {
        setActiveTab('rental'); // 로그인된 유저는 대여/반납 페이지 이동
      } else {
        handleAuthRedirect(); // 비로그인 유저는 MY탭으로 이동
      }
    } else {
      setActiveTab('map');
    }
  };


  return (
    <div className="map-container">
      {(activeTab === 'map' || activeTab === 'rental') && ( // 지도, 대여/반납 탭에서만 헤더 표시
      <header className="header">
        <div className="search-bar">
          <span className="rental-number" style={{whiteSpace: 'nowrap'}}>대여소 번호</span>
          <input type="text" placeholder="원하시는 지역이 어디신가요?" />
        </div>
      </header>)}

      {/* activeTab 값에 따라 다른 컴포넌트를 렌더링합니다. */}
      {activeTab === 'map' && (
        <MapContainer
          center={mapCenter}
          zoom={15}
          scrollWheelZoom={false}
          className="map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {stations.map((station) => (
            <Marker key={station.name} position={station.position}>
              <Popup>
                {station.name}
                <br />
                <button onClick={() => handleAddFavorite(station)}>
                  즐겨찾기 추가 (DB)
                </button>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}

      {activeTab === 'rental' && (
        <div className='rental-page'>
          <h2>우산 대여/반납</h2>
          <p>여기에 QR코드 스캔, 대여 정보 확인, 반납 버튼 등의 UI를 구성합니다.</p>
          
          <button className="action-button primary" onClick={() => alert("QR코드 스캔 기능 실행 (목업)")}>
            <FaQrcode style={{marginRight: '10px'}} /> 우산 대여 (QR 스캔)
          </button>
          <button className="action-button secondary" style={{marginTop: '15px'}} onClick={() => alert("반납 처리 기능 실행 (목업)")}>
            우산 반납
          </button>
          
          {isLoggedIn && (
            <div style={{marginTop: '30px', padding: '15px', border: '1px solid #eee', borderRadius: '8px'}}>
              <h3>대여 현황</h3>
              <p>현재 대여 중인 우산이 없습니다.</p>
              <p style={{fontSize: '12px', color: '#888'}}>로그인 상태: {userInfo?.email || '알 수 없음'}</p>
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'my' && (
        <div className='my-page'>
          <h2>마이 페이지</h2>
          
          <div className='my-list-item' onClick={isLoggedIn ? handleLogout : () => setIsSignup(!isSignup)}>
            <FaUser className='my-icon'/>
            <span>{isLoggedIn ? '로그아웃' : (isSignup ? '로그인으로 돌아가기' : '로그인 / 회원가입')}</span>
          </div>

          {isLoggedIn ? (
            // --- 로그인 상태 ---
            <div className="login-status-box logged-in">
              <p>환영합니다!</p>
              <p>현재 사용자: <strong>{userInfo?.email || '알 수 없음'}</strong></p>
              <button className="action-button secondary" onClick={handleLogout}>로그아웃</button>
            </div>
          ) : (
            // --- 비로그인 상태 & 폼 ---
            <div className="login-form-container">
              <h3>{isSignup ? '회원가입' : '로그인'}</h3>
              {authError && <p className="auth-error">{authError}</p>}
              {isSignup ? (
                <>
                  <EmailInputFields/>
                  
                  <input type="password" name="password" placeholder="비밀번호 (6자 이상)" value={loginForm.password} onChange={handleInputChange} className="login-input" />
                  <input type="password" name="passwordConfirm" placeholder="비밀번호 확인" value={loginForm.passwordConfirm} onChange={handleInputChange} className="login-input" />
                  <input type="tel" name="phone" placeholder="핸드폰 번호(숫자만 입력)" value={loginForm.phone} onChange={handleInputChange} className="login-input" />
                  <div className="two-factor-check">
                    <input type="checkbox" name="isTwoFactorEnabled" id="twoFactor" checked={loginForm.isTwoFactorEnabled} onChange={handleInputChange} />
                    <label htmlFor="twoFactor">2단계 인증 활성화</label>
                  </div>
                </>
              ) : (
                <>
                  <input type="email" name="email" placeholder="이메일" value={loginForm.email} onChange={handleInputChange} className="login-input" />
                  <input type="password" name="password" placeholder="비밀번호" value={loginForm.password} onChange={handleInputChange} className="login-input" />
                </>
              )}
              <button className="action-button primary" onClick={() => handleAuth(isSignup)}>
                {isSignup ? '회원가입 완료' : '로그인'}
              </button>
              <button className="action-button secondary" onClick={() => setIsSignup(!isSignup)} style={{marginTop: '10px'}}>
                {isSignup ? '로그인 화면으로' : '회원가입'}
              </button>
              
              <div style={{marginTop: '20px'}}>
                  <button className="action-button social-google" onClick={() => handleSocialLogin('Google')}>
                      <FaGoogle style={{marginRight: '8px'}} /> Google (UI 목업)
                  </button>
              </div>
            </div>
          )}
          <p style={{marginTop: '20px', color: '#999', fontSize: '12px', textAlign: 'center'}}>
              * 현재 Node.js 서버(5000포트)와 연동됩니다.
          </p>
        </div>
      )}

      {activeTab === 'favorites' && (
        <div className='favorites-page'>
          <div className='favorites-header'>
            <h3>즐겨찾기 목록 ({isLoggedIn ? 'DB 연동' : '로그인 필요'})</h3>
            <div className='new-list'>
              <FaPlus/> 새 리스트 만들기
            </div>
          </div>
          <div className='favorites-list-container'>
            {favorites.length > 0 ? (
              favorites.map((fav) => (
                <div key={fav.name} className='favorite-item' onClick={() => handleGoToFavorite(fav.position)}>
                  <div className='item-icon-wrapper'>
                    <FaStar className='item-icon'/>
                  </div>
                  <div className='item-details'>
                    <span className='item-name'>{fav.name}</span>
                    <div className='item-sub-info'>
                      <FaLock/>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p>{isLoggedIn ? '현재 즐겨찾기에 추가된 대여소가 없습니다.' : '즐겨찾기 목록을 보려면 로그인해 주세요.'}</p>
            )}
          </div>
        </div>
      )}

      <footer className="footer">
        {activeTab === 'map' && (
            <div className="time-display">12 min</div>
        )}
        
        <div className="nav-buttons">
          {/* 1. MY 버튼 */}
          <button className="nav-button" onClick={() => handleTabToggle('my')}>MY</button>
          
          {/* 2. 빈 공간 */}
          <button className="nav-button invisible-button" style={{visibility: 'hidden'}}></button>

          {/* 3. 빈 공간 */}
          <button className="nav-button invisible-button" style={{visibility: 'hidden'}}></button>
          
          {/* 4. 빈 공간 */}
          <button className="nav-button invisible-button" style={{visibility: 'hidden'}}></button>

          {/* 5. 즐겨찾기 버튼 */}
          <button className="nav-button" onClick={() => handleTabToggle('favorites')}>즐겨찾기</button>
        </div>
      </footer>
      
      {/* 중앙 고정 버튼 (Footer 밖, map-container 안에 위치) */}
      <div className="center-button-wrapper">
          <button 
            className="center-round-button" 
            onClick={handleCenterButtonClick}
          >
            {activeTab === 'map' ? (
                <FaQrcode style={{fontSize: '32px', color: '#fff'}} />
            ) : (
                <FaHome style={{fontSize: '32px', color: '#fff'}} />
            )}
          </button>
      </div>
    </div>
  );
};

export default MapComponent;