import React, { useState } from 'react';
import './App.css'; // CSS 파일 불러오기
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; // Leaflet 기본 CSS

// Leaflet 마커 아이콘 설정 (기본 아이콘이 깨지는 경우)
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
});
L.Marker.prototype.options.icon = DefaultIcon;

const MapComponent = () => {
  // 지도의 중심 좌표와 줌 레벨 설정
  const position = [37.45, 126.65]; // 예시: 인천 미추홀구 주변

  // 현재 활성화된 탭을 관리하는 상태
  const [activeTab, setActiveTab] = useState('map');

  // 즐겨찾기 목록을 관리하는 상태
  const [favorites, setFavorites] = useState([]);

  return (
    <div className="map-container">
      {/* 헤더 */}
      <header className="header">
        <div className="search-bar">
          {/* 검색창, 대여소 번호 드롭다운 등 */}
          <span>대여소 번호</span>
          <input type="text" placeholder="원하시는 지역이 어디신가요?" />
        </div>
      </header>

      {/* 지도 부분 */}
      <MapContainer
        center={position}
        zoom={15}
        scrollWheelZoom={false}
        className="map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* 마커 추가 */}
        <Marker position={position}>
          <Popup>
            대여소 위치 <br /> (인천 미추홀구 주변)
          </Popup>
        </Marker>
      </MapContainer>
      {activeTab === 'my' && (
        <div className='my-page'>
          <h2>마이 페이지</h2>
          <p>로그인 및 회원가입 관련 UI가 여기 들어갑니다.</p>
        </div>
      )}

      {activeTab === 'favorites' && (
        <div className='favorites-page'>
          <h2>즐겨찾기 목록</h2>
          <ul>
            {favorites.map((station, index) => (<li key={index}>{station}</li>))}
          </ul>
        </div>
      )}
      
      {/* 하단 바 (시간 표시 포함) */}
      <footer className="footer">
        <div className="time-display">12 min</div>
        <div className="nav-buttons">
          <button className="nav-button">MY</button>
          <button className="nav-button">즐겨찾기</button>
          <button className="nav-button">QR코드</button>
        </div>
      </footer>
    </div>
  );
};

export default MapComponent;