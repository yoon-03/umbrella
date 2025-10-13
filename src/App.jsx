<<<<<<< HEAD
import React, { useState, useEffect } from 'react';
=======
import React, { useState, useEffect } from 'react'; // useEffect 추가
>>>>>>> b3068873eeaeca1bce31c1819b78e1dff3ea3c36
import './App.css'; 
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; 
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
<<<<<<< HEAD

import { FaPlus, FaStar, FaLock, FaUser, FaGoogle } from 'react-icons/fa';

// --- 백엔드 설정 ---
const BACKEND_URL = 'http://localhost:5000';
// -----------------
=======
import { FaPlus, FaStar, FaLock, FaUser } from 'react-icons/fa';
>>>>>>> b3068873eeaeca1bce31c1819b78e1dff3ea3c36

//프론트, 백, DB 연결한 버전

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
});
L.Marker.prototype.options.icon = DefaultIcon;

<<<<<<< HEAD
// 예시 대여소 데이터
const stations = [
  { name: '미추홀구 대여소', position: [37.45, 126.65] },
  { name: '강남역 대여소', position: [37.498, 127.02] },
  { name: '신도림역 대여소', position: [37.508, 126.88] },
];

const MapComponent = () => {
  // 지도 및 탭 상태
  const [mapCenter, setMapCenter] = useState(stations[0].position);
  const [activeTab, setActiveTab] = useState('map');
  const [favorites, setFavorites] = useState([]);

  // --- JWT 인증 상태 ---
  const [userToken, setUserToken] = useState(localStorage.getItem('userToken'));
  const [userInfo, setUserInfo] = useState(null); 
  const isLoggedIn = !!userToken;
  
  // 인증 폼 상태
  const [isSignup, setIsSignup] = useState(false); 
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [authError, setAuthError] = useState('');
  
  // 컴포넌트 마운트 및 토큰 변경 시 사용자 정보 및 즐겨찾기 가져오기
  useEffect(() => {
    if (userToken) {
      fetchUserInfo();
      fetchFavorites();
=======
// 백엔드 API 서버 주소 (Node.js 서버 주소)
const API_URL = 'http://localhost:4000/api/stations';

const MapComponent = () => {
  // DB에서 가져온 대여소 목록을 저장할 상태
  const [stations, setStations] = useState([]);
  // 로딩 상태를 관리합니다.
  const [loading, setLoading] = useState(true); 
  
  // 지도의 중심 좌표를 상태로 관리합니다. (초기값은 서울 시청 근처로 설정하거나, 데이터가 로드된 후 첫 번째 대여소 위치로 설정합니다.)
  const [mapCenter, setMapCenter] = useState([37.5665, 126.9780]); 
  
  const [activeTab, setActiveTab] = useState('map');
  const [favorites, setFavorites] = useState([]);


  // DB 데이터 가져오기

  useEffect(() => {
    fetch(API_URL)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        // 1. DB 데이터를 지도에 필요한 형태로 가공 (lat, lng -> position 배열)
        const mapData = data.map(station => ({
          name: station.name,
          // DB에서 가져온 lat(위도), lng(경도)를 position 배열로 사용
          position: [station.lat, station.lng], 
          count: station.count,
          station_id: station.station_id,
        }));
        
        setStations(mapData); // 가공된 데이터 저장
        
        // 2. 데이터가 로드되면 지도의 중심을 첫 번째 대여소로 설정
        if (mapData.length > 0) {
          setMapCenter(mapData[0].position);
        }

        setLoading(false); // 로딩 완료
      })
      .catch(error => {
        console.error("데이터 가져오기 오류:", error);
        alert("대여소 데이터를 불러오는 데 실패했습니다. 서버를 확인해주세요.");
        setLoading(false);
      });
  }, []); // 컴포넌트가 처음 렌더링될 때 한 번만 실행

  // 즐겨찾기 추가 함수 (기존 로직 유지)
  const handleAddFavorite = (station) => {
    const isFavorite = favorites.some(fav => fav.name === station.name);
    if (!isFavorite) {
      setFavorites([...favorites, station]);
      alert(`${station.name}이(가) 즐겨찾기에 추가되었습니다.`);
>>>>>>> b3068873eeaeca1bce31c1819b78e1dff3ea3c36
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
    
    if (loginForm.password.length < 6) {
        return setAuthError('비밀번호는 6자 이상이어야 합니다.');
    }

    try {
      const response = await fetch(BACKEND_URL + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('userToken', data.token);
        setUserToken(data.token);
        setLoginForm({ email: '', password: '' });
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


  // 입력 필드 변경 핸들러
  const handleInputChange = (e) => {
    setLoginForm({ ...loginForm, [e.target.name]: e.target.value });
    setAuthError('');
  };
  
  // 소셜 로그인 목업
  const handleSocialLogin = (providerName) => {
      alert(`소셜 로그인: ${providerName} 연동을 위해서는 백엔드 서버에서 OAuth 처리가 필요합니다.`);
  };


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

  // 즐겨찾기 목록 항목 클릭 시 지도 위치로 이동하는 함수 (기존 로직 유지)
  const handleGoToFavorite = (position) => {
    setMapCenter(position); 
    setActiveTab('map'); 
  };
  
  // 탭 전환 핸들러 (토글 로직 적용)
  const handleTabToggle = (tabName) => {
      if (activeTab === tabName) {
          setActiveTab('map');
      } else {
          setActiveTab(tabName);
      }
  };


  // 데이터 로딩 중 표시
  if (loading) {
    return <div className="loading-screen">데이터를 불러오는 중입니다...</div>;
  }

  return (
    <div className="map-container">
      {/* 헤더 */}
      <header className="header">
        <div className="search-bar">
<<<<<<< HEAD
          <span className="rental-number" style={{whiteSpace: 'nowrap'}}>대여소 번호</span>
=======
          <span className="rental-number">대여소 번호</span>
>>>>>>> b3068873eeaeca1bce31c1819b78e1dff3ea3c36
          <input type="text" placeholder="원하시는 지역이 어디신가요?" />
        </div>
      </header>

      {/* activeTab 값에 따라 다른 컴포넌트를 렌더링합니다. */}
      {activeTab === 'map' && (
        <MapContainer
          center={mapCenter}
          zoom={15}
          scrollWheelZoom={true} // 스크롤 줌 기능 복원
          className="map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
<<<<<<< HEAD
          {stations.map((station) => (
            <Marker key={station.name} position={station.position}>
              <Popup>
                {station.name}
=======
          
          {/* DB에서 가져온 stations 데이터로 마커를 생성합니다. */}
          {stations.map((station) => (
            <Marker key={station.station_id} position={station.position}>
              <Popup> 
                <strong>{station.name}</strong>
                <br />
                남은 우산: {station.count}개
>>>>>>> b3068873eeaeca1bce31c1819b78e1dff3ea3c36
                <br />
                <button onClick={() => handleAddFavorite(station)}>
                  즐겨찾기 추가 (DB)
                </button>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}

      {/* 마이페이지, 즐겨찾기 페이지 (기존 로직 유지) */}
      {activeTab === 'my' && (
        <div className='my-page'>
          <h2>마이 페이지</h2>
          
          <div className='my-list-item' onClick={() => { 
                if (isLoggedIn) handleLogout();
                else setIsSignup(!isSignup);
            }}>
            <FaUser className='my-icon'/>
            <span>{isLoggedIn ? '로그아웃' : (isSignup ? '로그인으로 돌아가기' : '로그인 / 회원가입')}</span>
          </div>
<<<<<<< HEAD

          {isLoggedIn ? (
            // --- 로그인 상태 ---
            <div className="login-status-box logged-in">
              <p>로그인되었습니다.</p>
              <p><strong>{userInfo?.email || '알 수 없음'}</strong> 님</p>
              <button className="action-button secondary" onClick={handleLogout}>로그아웃</button>
            </div>
          ) : (
            // --- 비로그인 상태 & 폼 ---
            <div className="login-form-container">
              <h3>{isSignup ? '회원가입' : '로그인'}</h3>
              {authError && <p className="auth-error">{authError}</p>}
              <input 
                type="email" 
                name="email" 
                placeholder="이메일" 
                value={loginForm.email} 
                onChange={handleInputChange} 
                className="login-input"
              />
              <input 
                type="password" 
                name="password" 
                placeholder="비밀번호 (6자 이상)" 
                value={loginForm.password} 
                onChange={handleInputChange} 
                className="login-input"
              />
              <button 
                className="action-button primary" 
                onClick={() => handleAuth(isSignup)}
              >
                {isSignup ? '회원가입 완료' : '로그인'}
              </button>
              <button 
                className="action-button secondary" 
                onClick={() => setIsSignup(!isSignup)}
              >
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
=======
          <p>여기에 로그인 및 회원가입 UI가 들어간다.</p>
>>>>>>> b3068873eeaeca1bce31c1819b78e1dff3ea3c36
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
              favorites.map((station) => (
<<<<<<< HEAD
                <div key={station.name} className='favorite-item' onClick={() => handleGoToFavorite(station.position)}>
=======
                <div key={station.station_id} className='favorite-item' onClick={() => handleGoToFavorite(station.position)}>
>>>>>>> b3068873eeaeca1bce31c1819b78e1dff3ea3c36
                  <div className='item-icon-wrapper'>
                    <FaStar className='item-icon'/>
                  </div>
                  <div className='item-details'>
                    <span className='item-name'>{station.name}</span>
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

      {/* 하단 바 (시간 표시 포함) */}
      <footer className="footer">
        <div className="time-display">12 min</div>
        <div className="nav-buttons">
<<<<<<< HEAD
          <button className="nav-button" onClick={() => handleTabToggle('my')}>MY</button>
          <button className="nav-button" onClick={() => handleTabToggle('favorites')}>즐겨찾기</button>
=======
          <button className="nav-button" onClick={() => setActiveTab(activeTab === 'my' ? 'map' : 'my')}>MY</button>
          <button className="nav-button" onClick={() => setActiveTab(activeTab === 'favorites' ? 'map' : 'favorites')}>즐겨찾기</button>
>>>>>>> b3068873eeaeca1bce31c1819b78e1dff3ea3c36
          <button className="nav-button" onClick={() => setActiveTab('map')}>QR코드</button>
          <button className="nav-button" onClick={() => setActiveTab('map')}>이용권</button>
        </div>
      </footer>
    </div>
  );
};

export default MapComponent;
