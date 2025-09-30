import React, { useState } from 'react';
import './App.css'; // CSS 파일 불러오기
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; // Leaflet 기본 CSS

// Leaflet 마커 아이콘 설정 (기본 아이콘이 깨지는 경우)
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

import { FaPlus, FaStar, FaLock, FaUser } from 'react-icons/fa';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
});
L.Marker.prototype.options.icon = DefaultIcon;

// 예시 대여소 데이터
const stations = [
  { name: '미추홀구', position: [37.45, 126.65] },
  { name: '강남역', position: [37.498, 127.02] },
];

const MapComponent = () => {
  // 지도의 중심 좌표를 상태로 관리합니다.
  const [mapCenter, setMapCenter] = useState(stations[0].position);
  // 현재 활성화된 탭을 관리하는 상태
  const [activeTab, setActiveTab] = useState('map');
  // 즐겨찾기 목록을 관리하는 상태
  const [favorites, setFavorites] = useState([]);

  // 즐겨찾기 추가 함수
  const handleAddFavorite = (station) => {
    // 즐겨찾기에 이미 추가된 대여소인지 확인
    const isFavorite = favorites.some(fav => fav.name === station.name);
    if (!isFavorite) {
      setFavorites([...favorites, station]);
      alert(`${station.name}이(가) 즐겨찾기에 추가되었습니다.`);
    } else {
      alert(`${station.name}은(는) 이미 즐겨찾기에 있습니다.`);
    }
  };

  // 즐겨찾기 목록 항목 클릭 시 지도 위치로 이동하는 함수
  const handleGoToFavorite = (position) => {
    setMapCenter(position); // 지도의 중심 좌표를 업데이트
    setActiveTab('map'); // 지도 탭으로 전환
  };

  return (
    <div className="map-container">
      {/* 헤더 */}
      <header className="header">
        <div className="search-bar">
          {/* 검색창, 대여소 번호 드롭다운 등 */}
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
          scrollWheelZoom={false}
          className="map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {/* 각 대여소 데이터에 따라 마커를 자동으로 생성합니다. */}
          {stations.map((station) => (
            <Marker key={station.name} position={station.position}>
              <Popup> 
                {station.name}
                <br />
                <button onClick={() => handleAddFavorite(station)}>
                  즐겨찾기 추가
                </button>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}

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
                // 목록 클릭 시 지도 이동 함수를 호출합니다.
                <div key={station.name} className='favorite-item' onClick={() => handleGoToFavorite(station.position)}>
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
          <button className="nav-button" onClick={() => {
            if (activeTab === 'my') {
              setActiveTab('map');
            }
            else {
              setActiveTab('my');
            }
          }}
          >MY</button>
          <button className="nav-button" onClick={() => {
            if (activeTab === 'favorites') {
              setActiveTab('map');
            }
            else {
              setActiveTab('favorites');
            }
          }}
          >즐겨찾기</button>
          <button className="nav-button" onClick={() => setActiveTab('map')}>QR코드</button>
        </div>
      </footer>
    </div>
  );
};

export default MapComponent;
