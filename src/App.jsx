import React, { useState, useEffect, useCallback} from 'react';
import './App.css'; 
import { MapContainer, TileLayer, Marker, Popup, useMap} from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; 
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

import { FaStar, FaLock, FaUser, FaGoogle, FaHome, FaQrcode, FaCheck, FaMinusCircle} from 'react-icons/fa'; 

// --- 백엔드 설정 ---
const BACKEND_URL = 'http://localhost:4000';
// -----------------
// 대여소 거리 계산을 위한 상수 정의
const EARTH_RADIUS_KM = 6371;

// 두 위도/경도 간의 거리 계산 함수 (Haversine 공식)
const getDistance = (lat1, lon1, lat2, lon2) => {
    const toRad = (value) => (value * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return EARTH_RADIUS_KM * c; // 결과는 km
};

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
});
L.Marker.prototype.options.icon = DefaultIcon;

//대여소 조회를 위한 컴포넌트
function MapSearchCenterer({ position }) {
    const map = useMap();
    useEffect(() => {
        if (position) {
            // 해당 위치로 지도의 중심을 이동하고 부드러운 애니메이션을 적용 (Zoom: 17)
            map.flyTo(position, 17); 
        }
    }, [position, map]);
    return null;
}

const MapComponent = () => {
  // 지도 및 탭 상태
  const [stations, setStations] = useState([]);
  // const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState([37.4481, 126.657]); //초기 지도 인하공전으로
  const [activeTab, setActiveTab] = useState('map');
  const [favorites, setFavorites] = useState([]);
  //대여소 조회를 위해 추가
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
    // 검색 결과 클릭 시 해당 위치로 지도를 이동시키기 위해 추가
  const [centerPosition, setCenterPosition] = useState(null);
  //즐겨찾기 삭제를 위해 추가
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  //유저 위치 정보를 위해 추가
  const [userLocation, setUserLocation] = useState(null);
  //근처 대여소 표시를 위해 추가
  const [nearbyStations, setNearbyStations] = useState([]);
  // --- JWT 인증 상태 ---
  const [userToken, setUserToken] = useState(localStorage.getItem('userToken'));
  const [userInfo, setUserInfo] = useState(null); 
  const isLoggedIn = !!userToken;

 // 대여소 상세 및 대여 상태 관리
  const [selectedStationId, setSelectedStationId] = useState(null); // 목록을 보여줄 대여소 ID
  const [currentRentedUmbrellaId, setCurrentRentedUmbrellaId] = useState(null); // 현재 대여 중인 우산 ID
  const isReturnMode = !!currentRentedUmbrellaId; 
  const [availableUmbrella, setAvailableUmbrella] = useState([]); // 대여소별 가용 우산 목록

    // ✅ 근처 대여소 검색 활성화 상태 추가 (버튼 토글용)
  const [isNearbySearchActive, setIsNearbySearchActive] = useState(false); 
  const SEARCH_RADIUS = 2; // km

  const toggleDeleteMode = () => {
    setIsDeleteMode(prev => !prev);
};
//즐겨찾기 삭제
const handleRemoveFavorite = async (station) => {
    const stationId = station.station_id; 

    if (!isLoggedIn) {
        alert("로그인 후 이용 가능합니다.");
        return;
    }
    
    // station.name은 없으면 station.station_id를 대신 사용
    if (!window.confirm(`[${station.name || stationId}]을(를) 정말로 즐겨찾기에서 삭제하시겠습니까?`)) {
        return;
    }

    try {
        // ✅ 쿼리 파라미터로 stationId 변수를 사용하여 요청
        const res = await fetch(`${BACKEND_URL}/api/favorites?station_id=${stationId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${userToken}`,
            },
        });

        if (res.ok) {
            alert("즐겨찾기 삭제 완료!");
            // 삭제 후 목록을 새로고침합니다.
            fetchFavorites(); 
        } else {
            const data = await res.json();
            alert(data.error || "삭제 실패");
        }
    } catch (error) {
        console.error('Favorite remove error:', error);
        alert("서버 통신 오류");
    }
};
//근처 대여소 검색 토글 핸들러
const handleNearbySearch = () => {
    // 1. 상태 토글
    const newState = !isNearbySearchActive;
    setIsNearbySearchActive(newState);

    // 2. 검색 활성화 시 (새로 켜는 경우) 현재 위치를 다시 가져와 최신 위치를 확보
    if (newState) {
        getCurrentLocation(); // getCurrentLocation 함수는 이미 정의되어 있어야 합니다.
        setActiveTab('map'); // 지도로 이동
    } else {
        // 검색 종료 시 목록 초기화
        setNearbyStations([]);
    }
};

  
  // 인증 폼 상태
  const [isSignup, setIsSignup] = useState(false); 
  const [loginForm, setLoginForm] = useState({ 
    email: '',
    password: '',
    nickname: '',
    passwordConfirm: '',
    phonenumber: '',
    emailPrefix: '',
    emailDomain: 'gmail.com',
    isTwoFactorEnabled: false
  });
  const [authError, setAuthError] = useState('');
  
 const handleLogout = useCallback(() => {
    localStorage.removeItem('userToken');
    setUserToken(null);
    setUserInfo(null);
    setCurrentRentedUmbrellaId(null); 
    setAuthError('로그아웃되었습니다.');
    alert('로그아웃되었습니다.');
}, [setUserToken, setUserInfo, setAuthError, setCurrentRentedUmbrellaId]);


  const handleAuthRedirect = () => {
  setAuthError('대여 및 반납은 로그인 후 이용 가능합니다.');
  setActiveTab('my');
  };

  // 사용자 정보 가져오기
  const fetchUserInfo = useCallback(async () => {
    try {
        const response = await fetch(`${BACKEND_URL}/api/user`, {
            headers: { 'Authorization': `Bearer ${userToken}` },
        });
        if (response.ok) {
            const data = await response.json();
            setUserInfo(data);
            setCurrentRentedUmbrellaId(data.current_rental_id || null);
        } else {
            handleLogout(); // 👈 useCallback으로 감싸진 handleLogout 호출
        }
    } catch (error) {
        console.error('Failed to fetch user info:', error);
        handleLogout(); // 👈 useCallback으로 감싸진 handleLogout 호출
    }
}, [userToken, handleLogout]);

  // 즐겨찾기 목록 가져오기
  const fetchFavorites = useCallback(async () => {
    try {
        const res = await fetch(`${BACKEND_URL}/api/favorites`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });

        const data = await res.json();
        
        // 🚨 ✅ 수정: 백엔드에서 받은 키 이름(station_id, station_name 등)을 정확히 사용합니다.
        const formattedFavorites = data.map(fav => ({
            station_id: fav.station_id,       // <-- 이 값이 꼭 있어야 함
            name: fav.station_name,         // name으로 통일
            position: [fav.latitude, fav.longitude],
            // location: fav.station_location, // location이 백엔드에서 오지 않을 경우 삭제
        }));

        setFavorites(formattedFavorites);
    } catch (error) {
        console.error("즐겨찾기 로딩 오류:", error);
        setFavorites([]); // 오류 시 목록 비우기
    }
}, [userToken]);


  useEffect(() => {
    if (userToken) {
      fetchUserInfo();
      fetchFavorites();
    } else {
      setUserInfo(null);
      setFavorites([]);
    }
  }, [userToken, fetchUserInfo, fetchFavorites]);

  // ✅ 최초 렌더링 시 대여소(station) 데이터 불러오기
  useEffect(() => {
    const fetchStations = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/stations`);
        const data = await res.json();

        const formatted = data.map(st => ({
          station_id: st.station_id,
          name: st.name,
          location: st.station_location,
          position: [st.lat, st.lng], 
          region : st.region,
        }));

        setStations(formatted);
        // setLoading(false);
      } catch (err) {
        console.error('Station fetch error:', err);
      }
  };

  fetchStations();
}, []); // ✅ 빈 배열 → 컴포넌트가 처음 렌더링될 때 1회만 실행


  // 로그인 및 회원가입 처리
  const handleAuth = async (isSignupMode) => {
    setAuthError('');
    const endpoint = isSignupMode ? '/api/auth/signup' : '/api/auth/login';
    
    // ✅ 1. 함수 상단에 finalPayload 변수를 선언합니다.
    let finalPayload = loginForm; // 기본값은 loginForm으로 설정 (로그인 모드)

    if (loginForm.password.length < 6) {
        return setAuthError('비밀번호는 6자 이상이어야 합니다.');
    }

    if (isSignupMode) {
        // ... (유효성 검사 로직은 그대로) ...
        if (loginForm.password !== loginForm.passwordConfirm) {
            return setAuthError('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
        }
        const finalEmail = `${loginForm.emailPrefix}@${loginForm.emailDomain}`;
        if (!loginForm.emailPrefix || !loginForm.emailDomain || !finalEmail.includes('@')) {
            return setAuthError('이메일 아이디와 도메인을 정확히 입력해주세요.');
        }
        const phoneRegex = /^\d{10,11}$/;
        if (!phoneRegex.test(loginForm.phonenumber)) {
            return setAuthError('유효한 핸드폰 번호(10~11자리 숫자)를 입력해주세요.');
        }

        if(loginForm.nickname.trim()< 1 || loginForm.nickname.trim().Length >20){
            return setAuthError('닉네임은 1자 이상, 20자 이하로 작성해주세요.');
        }

        // ✅ 2. 회원가입 모드일 때만 finalPayload를 구성된 payload로 덮어씁니다.
        finalPayload = {
            email: finalEmail,
            password: loginForm.password,
            nickname: loginForm.nickname,
            phonenumber: loginForm.phonenumber,
            isTwoFactorEnabled: loginForm.isTwoFactorEnabled,
        };
    } // 👈 'finalPayload'는 if 블록 밖에서도 유효함

    try {
        const response = await fetch(BACKEND_URL + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // 🚨 3. finalPayload를 사용합니다.
            body: JSON.stringify(finalPayload), 
        });

        const data = await response.json();

      if (response.ok) {
        localStorage.setItem('userToken', data.token);
        setUserToken(data.token);
        const initialFormState = { email: '', password: '', passwordConfirm: '', nickname: '', phonenumber: '', emailPrefix: '', emailDomain: 'gmail.com', isTwoFactorEnabled: false }; 
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

  const EmailInputFields = ({ loginForm, handleInputChange }) => (
    <div className="email-split-container">
      <input
        type="text"
        name="emailPrefix"
        placeholder="이메일 아이디"
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
    alert("즐겨찾기는 로그인 후 이용 가능합니다.");
    return;
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/favorites`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ station_id: station.station_id }),
    });

    const data = await res.json();
    if (res.ok) {
      alert("즐겨찾기 추가 완료!");
      fetchFavorites();
    } else {
      alert(data.error);
    }
  } catch (error) {
    console.error(error);
    alert("서버 오류");
  }
};
//유저 위치 정보 가져오기
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                // 성공 시, 위치를 [위도, 경도] 배열로 설정
                setUserLocation([position.coords.latitude, position.coords.longitude]);
            },
            (error) => {
                console.error("Geolocation Error:", error);
                alert("현재 위치를 가져오는 데 실패했습니다. 위치 권한을 확인해주세요.");
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 } // 옵션
        );
    } else {
        alert("브라우저가 Geolocation을 지원하지 않습니다.");
    }
};
// 컴포넌트 마운트 시 위치 정보 요청
useEffect(() => {
    getCurrentLocation();
}, []);

  // 즐겨찾기 목록 항목 클릭 시 지도 위치로 이동하는 함수
  const handleGoToFavorite = (position) => {
    setMapCenter(position); 
    setActiveTab('map'); 
  };
  
  // 탭 전환 핸들러 (토글 로직 적용)
  const handleTabToggle = (tabName) => {
      if (activeTab === tabName) {
          setActiveTab('map');
          if (tabName === 'favorites') {
            setIsDeleteMode(false);
        }
      } else {
          setActiveTab(tabName);
      }
  };

const handleCenterButtonClick = () => {
    if (activeTab === 'map') {
        // 중앙 버튼은 대여소를 선택하지 않으므로 null을 전달 (QR 스캔 모드)
        navigateToRentalPage(null); 
    } else {
        setActiveTab('map'); // 다른 탭에서는 지도 화면으로 복귀
    }
};

  const handleReturnUmbrella = async (stationId, umbrellaId) => {
    if (!stationId || !umbrellaId) {
        alert("반납할 대여소와 우산 정보가 올바르지 않습니다.");
        return;
    }

    if (!window.confirm(`${stationId}번 대여소에 우산(${umbrellaId})을 반납하시겠습니까?`)) {
        return;
    }

    try {
        // 1. 서버로 반납 요청 전송 (POST)
        const res = await fetch(`${BACKEND_URL}/api/rental/return`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${userToken}`, // 토큰 필수
            },
            body: JSON.stringify({
                station_id: stationId, // 백엔드가 받는 키 이름: station_id
                umbrella_id: umbrellaId, // 백엔드가 받는 키 이름: umbrella_id
            }),
        });

        const data = await res.json();

        if (res.ok) {
            // 2. 성공 시 처리
            alert("반납이 완료되었습니다!");
            
            // 상태 초기화 (반납 모드 해제)
            setCurrentRentedUmbrellaId(null); 
            setSelectedStationId(null);
            setActiveTab('map'); // 지도로 복귀
            
            // 최신 유저 정보(대여 상태 등) 갱신
            fetchUserInfo(); 
            
            // 만약 현재 보고 있는 대여소의 우산 목록도 갱신하고 싶다면:
            // fetchAvailableUmbrella(stationId); 
        } else {
            // 3. 실패 시 에러 메시지 출력
            alert(data.error || "반납 처리에 실패했습니다.");
        }
    } catch (error) {
        console.error("Return request error:", error);
        alert("서버 통신 중 오류가 발생했습니다.");
    }
};
  
  const handleRentUmbrella = async (stationId, umbrellaId) => {
    if (!stationId || !umbrellaId) return;

    // 사용자 확인
    if (!window.confirm(`${stationId} 대여소에서 우산(${umbrellaId})을 대여하시겠습니까?`)) {
        return;
    }

    try {
        // 1. 서버로 대여 요청 전송 (POST)
        const res = await fetch(`${BACKEND_URL}/api/rental/rent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}` // 로그인 토큰 필수
            },
            body: JSON.stringify({ 
                station_id: stationId, 
                umbrella_id: umbrellaId 
            })
        });

        const data = await res.json();

        if (res.ok) {
            // 2. 성공 시 처리
            alert('대여가 성공적으로 완료되었습니다!');
            
            // 상태 업데이트 (대여 중 상태로 변경)
            setCurrentRentedUmbrellaId(umbrellaId); 
            setSelectedStationId(null);
            setActiveTab('map'); // 지도로 이동
            
            // 최신 유저 정보(대여 정보) 다시 불러오기
            fetchUserInfo(); 
        } else {
            // 3. 실패 시 에러 메시지
            alert(data.error || '대여 처리에 실패했습니다.');
        }
    } catch (error) {
        console.error('Rent request error:', error);
        alert('서버와 통신 중 오류가 발생했습니다.');
    }
};


  // 대여소의 가용 우산 목록을 가져오는 함수
  const fetchAvailableUmbrella = async (stationId) => {

    if (!stationId || !userToken) {
        console.error("❌ ID 또는 토큰이 없어서 중단합니다.");
        return;
    }

    try {
        const res = await fetch(`${BACKEND_URL}/api/stations/${stationId}/umbrella`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });
        
        if (res.ok) {
            const data = await res.json();
            setAvailableUmbrella(data);
        } else {
            console.error("❌  서버 응답 에러 (200 아님)");
            setAvailableUmbrella([]);
        }
    } catch (error) {
        console.error('❌  네트워크/코드 에러 발생:', error);
    }
};
  const navigateToRentalPage = (stationId) => {
   if (!isLoggedIn) {
      handleAuthRedirect(); // 로그인 없으면 MY 탭으로 이동
      return;
    }

  setSelectedStationId(stationId);
    
  if (!isReturnMode) {
      // 대여 모드일 경우에만 목록 조회 API 호출
      fetchAvailableUmbrella(stationId); 
    }
    
    setActiveTab('rental'); // 렌탈 페이지로 화면 전환
  };

  //검색 버튼 핸들러
    const handleSearch = async () => {
        if (!searchTerm.trim()) {
            setSearchResults([]);
            return;
        }

        try {
            // 백엔드 API 호출 시 region 쿼리 파라미터 전달
            const url = `${BACKEND_URL}/api/stations?region=${encodeURIComponent(searchTerm.trim())}`;
            const res = await fetch(url);
            
            if (!res.ok) {
                throw new Error('검색 오류 발생');
            }
            
            const data = await res.json();
            
            // station_id와 name, 그리고 위치 정보만 추출
            const formattedResults = data.map(st => ({
                station_id: st.station_id,
                name: st.name,
                position: [st.lat, st.lng],
            }));
            
            setSearchResults(formattedResults);
            
            // 검색 결과가 있다면 첫 번째 결과로 지도를 이동
            if (formattedResults.length > 0) {
                setCenterPosition(formattedResults[0].position);
            }
            
        } catch (err) {
            console.error('Search error:', err);
            setSearchResults([]);
        }
    };
    //검색 결과 클릭 핸들러
  const handleResultClick = (station) => {
        setCenterPosition(station.position);
        // 검색 결과를 숨기거나, 필요하다면 검색 결과 리스트를 닫는 추가 로직 구현 가능
    };
    // 근처 대여소 찾기 useEffect
  useEffect(() => {
      // isNearbySearchActive 상태가 true이고, 사용자 위치와 대여소 데이터가 있을 때만 실행
      if (isNearbySearchActive && userLocation && stations.length > 0) {
          const [userLat, userLon] = userLocation;
          
          const nearby = stations
              .map(station => {
                  const [stationLat, stationLon] = station.position;
                  // getDistance 함수는 MapComponent 밖에 정의되어 있어야 함
                  const distance = getDistance(userLat, userLon, stationLat, stationLon); 
                  
                  return { ...station, distance: distance };
              })
              .filter(station => station.distance <= SEARCH_RADIUS)
              .sort((a, b) => a.distance - b.distance); // 거리가 가까운 순으로 정렬
          
          setNearbyStations(nearby);
      } else if (!isNearbySearchActive) {
          setNearbyStations([]);
      }
  }, [isNearbySearchActive, userLocation, stations, SEARCH_RADIUS]); // 의존성 배열에 isNearbySearchActive 추가

  return (
    <div className="map-container">
      {activeTab === 'map' && (
      <header className="header">
        <div className="search-bar">
          <span className="rental-number" style={{whiteSpace: 'nowrap'}}>지역검색(동)</span>
          <input 
              type="text"
              placeholder="원하시는 지역이 어디신가요?" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              onKeyPress={(e) => { // Enter 키 입력 시 검색 실행
                    if (e.key === 'Enter') {
                        handleSearch();
                    }
                  }}
                />
                  {/*검색버튼*/}
                  <button className="search-button" onClick={handleSearch}>검색</button>
        <button 
          onClick={handleNearbySearch}
            style={{
            backgroundColor: isNearbySearchActive ? '#dc3545' : '#17a2b8', // 활성화/비활성화 시 색상 변경
            marginLeft: '5px',
            color: 'white'
            }}
            >
            {isNearbySearchActive ? '검색 종료' : '근처 대여소'}
        </button>

        </div>
      </header>)}

      {/*검색결과 */}
      {activeTab === 'map' && searchResults.length > 0 && (
          <div className="search-results-list">
              <h3>지역 검색 결과 ({searchResults.length}건)</h3>
              <ul>
                  {searchResults.map(station => (
                      <li 
                          key={station.station_id} 
                          onClick={() => handleResultClick(station)} // 클릭 시 지도 이동
                          style={{ cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid #eee' }}
                      >
                        {station.name}
                      </li>
                  ))}
              </ul>
          </div>
      )}

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
          {/* 검색 후 지도이동 */}
          <MapSearchCenterer position={centerPosition} />

          {/* 유저 위치 마커 */}
          {userLocation && (
              <Marker position={userLocation} icon={new L.divIcon({ 
                  className: 'user-location-icon', // 위에서 정의한 CSS 클래스
                  html: '<i class="fa fa-user"></i>', // Font Awesome 아이콘을 HTML로 삽입 (FaUser 아이콘의 CSS 클래스에 맞게 조정 필요)
                  iconAnchor: [15, 15], // 마커 중심을 아이콘 중앙에 맞춤 (30px/2)
                  popupAnchor: [0, -15], // 팝업 위치 조정 (30px/2)
              })}>
                  <Popup>
                      <b>현재 내 위치</b>
                      <br />
                      <FaUser style={{ verticalAlign: 'middle', marginRight: '5px' }} />
                  </Popup>
              </Marker>
          )}
          {/* 근처 대여소 찾는 로직 */}
          {isNearbySearchActive && userLocation && nearbyStations.length > 0 && (
            <div className="nearby-stations-list" style={{ padding: '15px', background: '#fff', borderTop: '1px solid #ddd', zIndex: 1000, position: 'relative' }}>
                <h3>⭐ 근처 대여소 ({SEARCH_RADIUS}km 이내 {nearbyStations.length}개)</h3>
                <ul>
                    {nearbyStations.map(station => (
                        <li 
                            key={station.station_id} 
                            // 클릭 시 해당 위치로 지도 이동 후, 근처 찾기 모드 종료
                            onClick={() => { 
                                setCenterPosition(station.position);
                                setIsNearbySearchActive(false); 
                            }} 
                            style={{ cursor: 'pointer', marginBottom: '5px', listStyle: 'none' }}
                        >
                            **{station.name}** ({station.distance.toFixed(2)} km)
                        </li>
                    ))}
                </ul>
            </div>
        )}
          {/* userLocation이 있지만 대여소가 없을 때 메시지 추가 */}
          {isNearbySearchActive && userLocation && nearbyStations.length === 0 && (
              <div style={{ padding: '15px', background: '#fff', borderTop: '1px solid #ddd', zIndex: 1000, position: 'relative', color: '#dc3545' }}>
                  <p>⚠️ {SEARCH_RADIUS}km 이내에 대여소를 찾을 수 없습니다.</p>
              </div>
          )}
          {stations.map((station) => (
            <Marker key={station.station_id} position={station.position}>
              <Popup>
                  {station.name}
                  <br></br>
                  {station.location}  
                  <br />
                  <button onClick={() => handleAddFavorite(station)}>
                      즐겨찾기 추가
                  </button>

                  {/* 대여/반납 버튼 */}
                  <button
                      onClick={() => navigateToRentalPage(station.station_id)}
                      style={{
                          marginTop: '5px',
                          background: isReturnMode ? '#dc3545' : '#28a745',
                          color: 'white'
                      }}
                  >
                      {isReturnMode ? '반납하기' : '대여/목록 보기'}
                  </button>
                </Popup>
              </Marker>
))}

        </MapContainer>
      )}

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

          {isLoggedIn ? (
            // --- 로그인 상태 ---
            <div className="login-status-box logged-in">
              <p>로그인되었습니다.</p>
              <p><strong>{userInfo?.nickname || '알 수 없음'}</strong> 님</p>
              <button className="action-button secondary" onClick={handleLogout}>로그아웃</button>
            </div>
          ) : (
            // --- 비로그인 상태 & 폼 ---
            <div className="login-form-container">
              <h3>{isSignup ? '회원가입' : '로그인'}</h3>
              {authError && <p className="auth-error">{authError}</p>}
              {isSignup ? (
                <>
                  
                  <EmailInputFields
                    loginForm={loginForm} 
                    handleInputChange={handleInputChange}
                  />
                  <input 
                    type="password" 
                    name="password" 
                    placeholder="비밀번호 (6자 이상)" 
                    value={loginForm.password} 
                    onChange={handleInputChange} 
                    className="login-input"
                  />
                  <input 
                    type="password" 
                    name="passwordConfirm" 
                    placeholder="비밀번호 확인" 
                    value={loginForm.passwordConfirm} 
                    onChange={handleInputChange} 
                    className="login-input"
                  />
                  <input
                    type="nickname"
                    name="nickname"
                    placeholder="닉네임"
                    value={loginForm.nickname}
                    onChange={handleInputChange}
                    className="login-input"
                  />
                  <input
                    type="tel"
                    name="phonenumber"
                    placeholder="핸드폰 번호(숫자만 입력)"
                    value={loginForm.phonenumber}
                    onChange={handleInputChange}
                    className="login-input"
                  />
                  <div className="two-factor-check">
                    <input
                      type="checkbox"
                      name="isTwoFactorEnabled"
                      id="twoFactor"
                      checked={loginForm.isTwoFactorEnabled}
                      onChange={handleInputChange}
                    />
                    <lable htmlFor="twoFactor">
                      2단계 인증 활성화
                    </lable>
                  </div>
                </>
              ) : (
                <>
                  <input
                    type="email"
                    name="email"
                    placeholder="아이디"
                    value={loginForm.email}
                    onChange={handleInputChange}
                    className="login-input"
                  />
                  <input 
                    type="password" 
                    name="password" 
                    placeholder="비밀번호" 
                    value={loginForm.password} 
                    onChange={handleInputChange} 
                    className="login-input"
                  />
                </>
              )}
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
              * 현재 Node.js 서버(4000포트)와 연동됩니다.
          </p>
        </div>
      )}

      {activeTab === 'favorites' && (
        <div className='favorites-page'>
          <div className='favorites-header'>
            <h3>즐겨찾기 목록 ({isLoggedIn ? 'DB 연동' : '로그인 필요'})</h3>
            {/* 즐겨찾기 창에서 나갈 시 즐겨찾기 삭제모드 풀리게 */}
            <button 
                onClick={() => handleTabToggle('favorites')} 
                style={{ background: 'none', border: 'none', fontSize: '1.5em', cursor: 'pointer', marginLeft: 'auto' }}
            >
                &times; 
            </button>
            <div className="new-list" onClick={toggleDeleteMode}>
                {/* isDeleteMode 상태에 따라 아이콘과 텍스트 변경 */}
                {isDeleteMode ? 
                    (<>
                        <FaCheck style={{ color: 'green' }}/> 삭제 모드 종료
                    </>) :
                    (<>
                        <FaMinusCircle style={{ color: 'red' }}/> 즐겨찾기 삭제
                    </>)
                }
            </div>
          </div>
          <div className='favorites-list-container'>
            {favorites.length > 0 ? (
      <ul>
          {favorites.map((station) => (
              // ✅ 기존 div를 li로 변경
              <li 
                  key={station.station_id} 
                  className='favorite-item-wrapper'
              >
                  {/* 1. 즐겨찾기 정보 (클릭 시 지도 이동) */}
                  {/* isDeleteMode가 아닐 때만 클릭하여 지도 이동 */}
                  <div 
                      className='favorite-item' 
                      onClick={() => !isDeleteMode && handleGoToFavorite(station.position)}
                      style={{ cursor: isDeleteMode ? 'default' : 'pointer' }}
                  >
                      <div className='item-icon-wrapper'>
                          <FaStar className='item-icon'/>
                      </div>
                      <div className='item-details'>
                          {/* station.name이 아닌 station_name을 사용해야 할 수 있습니다 (DB 조회 결과에 따라 다름) */}
                          <span className='item-name'>{station.station_name || station.name}</span> 
                          <div className='item-sub-info'>
                              <FaLock/> {/* 임시 자물쇠 아이콘 */}
                          </div>
                      </div>
                  </div>
                
                {/* 2. ✅ 새로 추가: 삭제 모드일 때만 삭제 버튼 표시 */}
                {isDeleteMode && (
                    <button 
                        className="delete-button" 
                        // 즐겨찾기 삭제 핸들러 연결
                        onClick={() => handleRemoveFavorite(station)} 
                        style={{ background: 'red', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer', marginLeft: '10px' }}
                    >
                        삭제
                    </button>
                )}
            </li>
        ))}
    </ul>
) : (
    <p>{isLoggedIn ? '현재 즐겨찾기에 추가된 대여소가 없습니다.' : '즐겨찾기 목록을 보려면 로그인해 주세요.'}</p>
)}
          </div>
        </div>
      )}

      {activeTab === 'rental' && (
         <div className='rental-page'>
          <h2>{isReturnMode ? '우산 반납하기' : '우산 대여하기'}</h2>
          
          <p>
            {isReturnMode ? 
              `현재 대여 중: ${currentRentedUmbrellaId}` : 
              `대여소: ${selectedStationId || 'QR 스캔 모드'}`
            }
          </p>
          
          {/* 목록 표시 */}
          {!isReturnMode && availableUmbrella.length > 0 && (
            <div style={{marginTop: '20px'}}>
              <h3>대여 가능한 우산 ({availableUmbrella.length}개)</h3>
              <ul style={{listStyle: 'none', padding: 0}}>
                {availableUmbrella.map(umbrella => (
                  <li 
                    key={umbrella.umbrella_id} 
                    style={{padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer'}}
                  >
                    우산 ID: {umbrella.umbrella_id}
                    <button 
                        onClick={() => handleRentUmbrella(selectedStationId, umbrella.umbrella_id)} 
                        style={{float: 'right', padding: '5px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px'}}
                    >
                        대여 선택
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* 반납 버튼 (반납 모드 시 활성화) */}
          {isReturnMode && (
            <button 
              className="action-button primary" 
              onClick={() => handleReturnUmbrella(selectedStationId, currentRentedUmbrellaId)} 
              style={{marginTop: '30px', backgroundColor: '#dc3545'}}
            >
               우산 반납 실행 ({currentRentedUmbrellaId})
             </button>
          )}

          {/* 대여 가능 우산이 없을 때 */}
          {!isReturnMode && availableUmbrella.length === 0 && (
            <p style={{color: 'red', marginTop: '20px'}}>현재 이 대여소에 대여 가능한 우산이 없습니다.</p>
          )}
        </div>
       )}

      <footer className="footer">
        {/* 하단 버튼 4개 (중앙 버튼 자리 비움) */}
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
      
      {/* ✅ 중앙 고정 버튼 (Footer 밖, map-container 안에 위치) */}
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
