import React, { useState, useEffect } from 'react'; // useEffect 추가
import './App.css'; 
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; 
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { FaPlus, FaStar, FaLock, FaUser } from 'react-icons/fa';

//프론트, 백, DB 연결한 버전

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
});
L.Marker.prototype.options.icon = DefaultIcon;

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
    } else {
      alert(`${station.name}은(는) 이미 즐겨찾기에 있습니다.`);
    }
  };

  // 즐겨찾기 목록 항목 클릭 시 지도 위치로 이동하는 함수 (기존 로직 유지)
  const handleGoToFavorite = (position) => {
    setMapCenter(position); 
    setActiveTab('map'); 
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
          <span className="rental-number">대여소 번호</span>
          <input type="text" placeholder="원하시는 지역이 어디신가요?" />
        </div>
      </header>

      {/* activeTab 값에 따라 다른 컴포넌트를 렌더링합니다. */}
      {activeTab === 'map' && (
        <MapContainer
          // 지도의 center 속성을 상태 변수 mapCenter로 연결
          center={mapCenter}
          zoom={15}
          scrollWheelZoom={true} // 스크롤 줌 기능 복원
          className="map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* DB에서 가져온 stations 데이터로 마커를 생성합니다. */}
          {stations.map((station) => (
            <Marker key={station.station_id} position={station.position}>
              <Popup> 
                <strong>{station.name}</strong>
                <br />
                남은 우산: {station.count}개
                <br />
                <button onClick={() => handleAddFavorite(station)}>
                  즐겨찾기 추가
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
          <div className='my-list-item'>
            <FaUser className='my-icon'/>
            <span>로그인 / 회원가입</span>
          </div>
          <p>여기에 로그인 및 회원가입 UI가 들어간다.</p>
        </div>
      )}

      {activeTab === 'favorites' && (
        <div className='favorites-page'>
          <div className='favorites-header'>
            <h3>즐겨찾기 목록</h3>
            <div className='new-list'>
              <FaPlus/> 새 리스트 만들기
            </div>
          </div>
          <div className='favorites-list-container'>
            {favorites.length > 0 ? (
              favorites.map((station) => (
                <div key={station.station_id} className='favorite-item' onClick={() => handleGoToFavorite(station.position)}>
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
              <p>즐겨찾기에 추가된 대여소가 없습니다.</p>
            )}
          </div>
        </div>
      )}

      {/* 하단 바 (시간 표시 포함) */}
      <footer className="footer">
        <div className="time-display">12 min</div>
        <div className="nav-buttons">
          <button className="nav-button" onClick={() => setActiveTab(activeTab === 'my' ? 'map' : 'my')}>MY</button>
          <button className="nav-button" onClick={() => setActiveTab(activeTab === 'favorites' ? 'map' : 'favorites')}>즐겨찾기</button>
          <button className="nav-button" onClick={() => setActiveTab('map')}>QR코드</button>
        </div>
      </footer>
    </div>
  );
};

export default MapComponent;
