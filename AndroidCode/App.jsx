 * 이 컴포넌트는 '우산 대여 서비스'의 핵심 화면입니다.
 * 지도(Google Maps)를 기반으로 내 위치와 대여소를 보여주고,
 * 로그인, 대여, 반납, 즐겨찾기 기능을 통합적으로 수행합니다.

import React, { useState, useEffect } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, Alert, ScrollView,
    StyleSheet, Platform, BackHandler, PermissionsAndroid, Keyboard 
} from 'react-native';

// 외부 라이브러리 임포트 (위치 정보, 아이콘, 저장소, 지도)
import Geolocation from 'react-native-geolocation-service';
import Icon from 'react-native-vector-icons/FontAwesome'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';


// 환경 설정 및 상수 정의


// [백엔드 주소] 안드로이드 에뮬레이터(10.0.2.2)와 실제 기기/iOS(localhost)를 구분합니다.
const BACKEND_URL = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';

// 대여소 거리 계산을 위해 상수 설정
const EARTH_RADIUS_KM = 6371;
const SEARCH_RADIUS_KM = 2; 


//  데이터 타입 정의 (TypeScript Interface)


// [대여소 정보] 서버에서 받아올 대여소 객체의 구조입니다.
interface Station {
    id: number;
    name: string;
    position: { latitude: number; longitude: number };
}

// [지도 좌표] 지도가 보여줄 중심 위치와 줌 레벨(확대 정도)입니다.
interface MapRegion {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
}

// 기능 함수 (Utility Functions)


/**
 * [거리 계산 함수]
 * 내 위치와 대여소 위치(위도/경도)를 이용해 거리를 계산합니다. (Haversine 공식 사용)
 * 결과값은 km 단위로 반환
 */
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
};


// 메인 컴포넌트 시작


const MapComponent: React.FC = () => {
    

    // [변수 선언부] 화면의 상태(State)를 관리하는 변수들입니다.

    // [로딩 상태] 앱이 처음 켜질 때 스플래시 화면을 보여줄지 결정합니다.
    const [isLoading, setIsLoading] = useState(true);

    // [대여소 데이터] 서버 DB에서 가져온 모든 대여소 목록을 저장합니다.
    const [stations, setStations] = useState<Station[]>([]);

    // [내 위치] GPS로 수신한 사용자의 현재 위치(위도, 경도)입니다.
    const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
    
    // [지도 뷰] 현재 화면에 보이는 지도의 중심 좌표와 줌 레벨입니다. (초기값: 인하공전)
    const [mapRegion, setMapRegion] = useState<MapRegion>({
      latitude: 37.4480,  
      longitude: 126.6575, 
      latitudeDelta: 0.005, // 값이 작을수록 지도가 확대됩니다.
      longitudeDelta: 0.005,
    });

    // [탭 상태] 사용자가 현재 보고 있는 화면(지도, 대여, 마이페이지 등)을 저장합니다.
    const [activeTab, setActiveTab] = useState('map'); 

    // [검색 기능] 검색창 입력값과 '근처 대여소 보기' 모드 활성화 여부입니다.
    const [searchTerm, setSearchTerm] = useState('');
    const [isNearbySearchActive, setIsNearbySearchActive] = useState(false);
    const [nearbyStations, setNearbyStations] = useState<any[]>([]);

    // [로그인 정보] 로그인 성공 시 서버에서 받은 토큰과 사용자 상세 정보입니다.
    const [userToken, setUserToken] = useState<string | null>(null);
    const [userInfo, setUserInfo] = useState<any>(null);
    const isLoggedIn = !!userToken; // 토큰이 있으면 '로그인 상태'로 간주합니다.

    // [대여/반납 로직] 선택한 대여소 ID와 내가 현재 빌린 우산 ID를 관리합니다.
    const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
    const [availableUmbrella, setAvailableUmbrella] = useState<any[]>([]); // 대여 가능 우산 목록
    const [currentRentedUmbrellaId, setCurrentRentedUmbrellaId] = useState<string | null>(null);
    const isReturnMode = !!currentRentedUmbrellaId; // 빌린 우산이 있으면 반납 모드로 동작합니다.

    // [즐겨찾기 & 폼] 즐겨찾기 목록과 로그인/회원가입 입력창 데이터입니다.
    const [favorites, setFavorites] = useState<any[]>([]);
    const [isDeleteMode, setIsDeleteMode] = useState(false); // 즐겨찾기 삭제 모드
    const [isSignup, setIsSignup] = useState(false); // 회원가입 화면인지 여부
    const [authError, setAuthError] = useState(''); // 로그인 에러 메시지
    const [loginForm, setLoginForm] = useState({
        email: '', password: '', passwordConfirm: '', nickname: '', phone: '', emailPrefix: '', emailDomain: 'gmail.com', isTwoFactorEnabled: false
    });

    // [초기화 로직] 앱 실행 시(Lifecycle) 자동으로 수행되는 작업입니다.
 
    // 앱이 시작되면 권한을 요청하고 초기 데이터를 불러옵니다.
    useEffect(() => {
        const initializeApp = async () => {
            // 1. 안드로이드인 경우 위치 권한을 사용자에게 요청합니다.
            if (Platform.OS === 'android') {
                await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
            }
            
            // 2. 현재 내 위치(GPS)를 가져옵니다.
            getCurrentLocation();
            
            // 3. 이전에 로그인한 기록(토큰)이 기기에 있는지 확인합니다 (자동 로그인).
            const token = await AsyncStorage.getItem('userToken');
            if (token) setUserToken(token);

            // 4. 서버 API를 호출해 전체 대여소 정보를 가져옵니다.
            await fetchStations();

            // 5. 2초 뒤에 로딩 화면을 끄고 본 화면을 보여줍니다.
            setTimeout(() => setIsLoading(false), 2000);
        };
        initializeApp();
    }, []);

    //  토큰이 변경되면(로그인/로그아웃) 사용자 정보를 새로고침합니다.
    useEffect(() => {
        if (userToken) { fetchUserInfo(); fetchFavorites(); } 
        else { setUserInfo(null); setFavorites([]); setCurrentRentedUmbrellaId(null); }
    }, [userToken]);

    //  '근처' 버튼이 켜져있으면 내 위치 기준 2km 이내 대여소를 실시간으로 찾습니다.
    useEffect(() => {
        if (isNearbySearchActive && userLocation && stations.length > 0 && !searchTerm) {
            const nearby = stations.map(st => {
                // 각 대여소와의 거리를 계산하고
                const dist = getDistance(userLocation.latitude, userLocation.longitude, st.position.latitude, st.position.longitude);
                return { ...st, distance: dist };
            })
            // 2km 이내인 곳만 남기고(변별력), 거리순으로 정렬합니다.
            .filter(st => st.distance <= SEARCH_RADIUS_KM)
            .sort((a, b) => a.distance - b.distance);

            setNearbyStations(nearby);
        }
    }, [isNearbySearchActive, userLocation, stations, searchTerm]);

    //  뒤로가기 버튼을 눌렀을 때 앱이 바로 꺼지지 않도록 처리합니다.
    useEffect(() => {
        const backAction = () => {
            if (activeTab === 'map') {
                if (isNearbySearchActive) { setIsNearbySearchActive(false); return true; } // 근처 목록 닫기
                Alert.alert("앱 종료", "종료하시겠습니까?", [{ text: "취소", style: "cancel" }, { text: "종료", onPress: () => BackHandler.exitApp() }]);
                return true;
            }
            setActiveTab('map'); return true; // 다른 탭이면 지도로 돌아옵니다.
        };
        const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
        return () => backHandler.remove();
    }, [activeTab, isNearbySearchActive]);

    // [핵심 기능 함수] 서버 통신 및 비즈니스 로직을 수행합니다.

    // GPS 기능을 이용해 현재 위치를 가져와서 지도를 이동시킵니다.
    const getCurrentLocation = () => {
        Geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setUserLocation({ latitude, longitude });
                setMapRegion(prev => ({ ...prev, latitude, longitude })); // 지도 중심 이동
            },
            (error) => console.log(error.code, error.message),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
    };

    // 서버에서 전체 대여소 목록(JSON)을 받아옵니다.
    const fetchStations = async () => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/stations`);
            const data = await response.json();
            // 받아온 데이터를 지도 마커 형식에 맞게 변환합니다.
            const formatted = data.map((st: any) => ({
                id: st.station_id || st.id,
                name: st.name || st.station_name,
                position: { latitude: parseFloat(st.lat), longitude: parseFloat(st.lng) }
            }));
            setStations(formatted);
        } catch (e) { console.error('Station Fetch Error', e); }
    };

    //  로그인한 사용자의 정보를 서버에서 조회합니다.
    const fetchUserInfo = async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/user`, { headers: { 'Authorization': `Bearer ${userToken}` } });
            if (res.ok) {
                const data = await res.json();
                setUserInfo(data);
                // 현재 대여 중인 우산이 있다면 그 ID를 저장합니다.
                setCurrentRentedUmbrellaId(data.current_rental_id || null);
            } else handleLogout(); // 토큰이 만료되었으면 로그아웃 처리
        } catch (e) { console.error(e); }
    };

    // 즐겨찾기 목록을 가져옵니다.
    const fetchFavorites = async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/favorites`, { headers: { 'Authorization': `Bearer ${userToken}` } });
            if (res.ok) setFavorites(await res.json());
        } catch (e) { console.error(e); }
    };

    // 로그인 또는 회원가입 요청을 서버로 보냅니다.
    const handleAuth = async (isSignupMode: boolean) => {
        setAuthError('');
        const endpoint = isSignupMode ? '/api/auth/signup' : '/api/auth/login';
        let payload: any = { ...loginForm };
        
        // 회원가입 모드일 때 이메일 주소 조합
        if (isSignupMode) {
            if (loginForm.password !== loginForm.passwordConfirm) return setAuthError('비밀번호가 일치하지 않습니다.');
            payload.email = `${loginForm.emailPrefix}@${loginForm.emailDomain}`;
        } else {
            payload = { email: loginForm.email, password: loginForm.password };
        }
        
        try {
            const res = await fetch(`${BACKEND_URL}${endpoint}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (res.ok) {
                // 성공 시 토큰을 저장하고 로그인 상태로 전환합니다.
                await AsyncStorage.setItem('userToken', data.token);
                setUserToken(data.token); setIsSignup(false);
                Alert.alert("성공", isSignupMode ? "회원가입 완료" : "로그인 성공");
            } else setAuthError(data.error || '실패');
        } catch (e) { setAuthError('서버 연결 실패'); }
    };

    // 로그아웃 처리 (토큰 삭제 및 상태 초기화)
    const handleLogout = async () => {
        await AsyncStorage.removeItem('userToken');
        setUserToken(null); setUserInfo(null); setCurrentRentedUmbrellaId(null);
        Alert.alert("로그아웃 되었습니다.");
    };

    //지역명으로 대여소를 검색합니다.
    const handleSearch = async () => {
        if (!searchTerm.trim()) return;
        Keyboard.dismiss(); // 키보드 내리기
        try {
            const res = await fetch(`${BACKEND_URL}/api/stations?region=${encodeURIComponent(searchTerm)}`);
            const data = await res.json();
            
            if (data.length > 0) {
                // 검색 결과가 있으면 첫 번째 결과 위치로 지도를 이동시킵니다.
                setMapRegion(prev => ({ 
                    ...prev, 
                    latitude: parseFloat(data[0].lat), 
                    longitude: parseFloat(data[0].lng) 
                }));
                // 검색 결과를 리스트 형태로 변환하여 화면에 띄웁니다.
                const searchResults = data.map((st: any) => ({
                    id: st.station_id || st.id,
                    name: st.name || st.station_name,
                    position: { latitude: parseFloat(st.lat), longitude: parseFloat(st.lng) },
                    distance: 0 
                }));
                setNearbyStations(searchResults);
                setIsNearbySearchActive(true); 
            } else {
                Alert.alert("결과 없음", "해당 지역에 대여소가 없습니다.");
            }
        } catch (e) { console.error(e); }
    };

    //대여소 마커를 눌렀을 때 대여 페이지로 이동합니다.
    const navigateToRentalPage = async (stationId: number | null) => {
        if (!isLoggedIn) {
            Alert.alert("로그인 필요", "로그인 후 이용해주세요.");
            setActiveTab('my');
            return;
        }
        if (stationId) {
            setSelectedStationId(stationId);
            // 반납 모드가 아니면(대여하려면), 해당 대여소의 '대여 가능 우산'을 조회합니다.
            if (!isReturnMode) {
                const res = await fetch(`${BACKEND_URL}/api/stations/${stationId}/umbrella`, { headers: { Authorization: `Bearer ${userToken}` } });
                setAvailableUmbrella(await res.json());
            }
        }
        setActiveTab('rental');
    };

    //[대여 실행] 우산 대여 버튼 클릭 시
    const handleRent = async (uId: string) => {
        Alert.alert("대여 확인", "대여하시겠습니까?", [
            { text: "취소", style: "cancel" },
            { text: "대여", onPress: async () => {
                const res = await fetch(`${BACKEND_URL}/api/rental/rent`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
                    body: JSON.stringify({ station_id: selectedStationId, umbrella_id: uId })
                });
                if (res.ok) { Alert.alert("성공", "대여 완료!"); fetchUserInfo(); setActiveTab('map'); }
                else Alert.alert("실패", "대여 실패");
            }}
        ]);
    };

    //[반납 실행] 우산 반납 버튼 클릭 시
    const handleReturn = async () => {
        Alert.alert("반납 확인", "반납하시겠습니까?", [
            { text: "취소", style: "cancel" },
            { text: "반납", onPress: async () => {
                const res = await fetch(`${BACKEND_URL}/api/rental/return`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
                    body: JSON.stringify({ station_id: selectedStationId, umbrella_id: currentRentedUmbrellaId })
                });
                if (res.ok) { Alert.alert("성공", "반납 완료!"); fetchUserInfo(); setActiveTab('map'); }
                else Alert.alert("실패", "반납 실패");
            }}
        ]);
    };

    //즐겨찾기 추가 함수
    const handleAddFavorite = async (stationId: number) => {
        if (!isLoggedIn) return Alert.alert("로그인 필요");
        await fetch(`${BACKEND_URL}/api/favorites`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
            body: JSON.stringify({ station_id: stationId })
        });
        fetchFavorites();
        Alert.alert("완료", "즐겨찾기 추가됨");
    };

    // [화면 렌더링] UI를 구성하는 부분입니다.
    // 로딩 중일 때 스플래시 화면을 보여줍니다.
    if (isLoading) {
        return (
            <View style={styles.splashContainer}>
                <Text style={styles.splashText}>우산 대여 서비스</Text>
            </View>
        );
    }

    //[지도 탭] 렌더링 함수: 지도, 검색창, 마커 등을 표시합니다.
    const renderMapTab = () => (
        <View style={styles.map}>
            {/* 상단 검색바 & 근처 버튼 */}
            <View style={styles.headerOverlay}>
                <TextInput 
                    style={styles.searchInput} 
                    placeholder="지역 검색 (예: 용현)" 
                    value={searchTerm} 
                    onChangeText={setSearchTerm} 
                    onSubmitEditing={handleSearch}
                />
                <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}><Icon name="search" size={20} color="white" /></TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.nearbyBtn, { backgroundColor: isNearbySearchActive ? '#dc3545' : '#17a2b8' }]} 
                    onPress={() => { 
                        if(isNearbySearchActive) {
                            setIsNearbySearchActive(false); // 닫기
                            setSearchTerm('');
                        } else {
                            setIsNearbySearchActive(true); // 열기
                            setSearchTerm('');
                            getCurrentLocation(); // 내 위치 갱신
                        }
                    }}
                >
                    <Text style={{color:'white'}}>{isNearbySearchActive ? '닫기' : '근처'}</Text>
                </TouchableOpacity>
            </View>

            {/* 검색 또는 근처 대여소 목록 (리스트 뷰) */}
            {isNearbySearchActive && nearbyStations.length > 0 && (
                <View style={styles.nearbyListContainer}>
                    <Text style={{fontWeight:'bold', padding:10, borderBottomWidth:1, borderColor:'#eee'}}>
                        {searchTerm ? `검색 결과 (${nearbyStations.length})` : `내 근처 대여소 (${nearbyStations.length})`}
                    </Text>
                    <ScrollView style={{maxHeight: 150}}>
                        {nearbyStations.map((st, i) => (
                            <TouchableOpacity key={i} style={styles.nearbyItem} onPress={() => { setMapRegion(prev=>({...prev, latitude: st.position.latitude, longitude: st.position.longitude})); }}>
                                <Text>{st.name} {st.distance > 0 ? `(${st.distance.toFixed(2)}km)` : ''}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* 구글 지도 컴포넌트 */}
            <MapView
                provider={PROVIDER_GOOGLE}
                style={styles.mapView}
                region={mapRegion}
                onRegionChangeComplete={setMapRegion}
                showsUserLocation={true}       // 내 위치 파란 점 표시
                followsUserLocation={false}    // 지도 자동 이동 끔
                showsMyLocationButton={true}   // 내 위치로 이동 버튼
            >
                {/* 지도 위에 대여소 핀(마커)을 찍습니다. */}
                {stations.map(station => (
                    <Marker
                        key={station.id}
                        coordinate={station.position}
                        title={station.name}
                        onPress={() => {
                            // 마커 클릭 시 동작 선택 (대여/반납/즐겨찾기)
                            Alert.alert(station.name, "무엇을 하시겠습니까?", [
                                { text: "대여/반납", onPress: () => navigateToRentalPage(station.id) },
                                { text: "즐겨찾기", onPress: () => handleAddFavorite(station.id) },
                                { text: "취소", style: "cancel" }
                            ]);
                        }}
                    />
                ))}
            </MapView>
        </View>
    );

    //[대여/반납 탭] 렌더링 함수
    const renderRentalTab = () => (
        <ScrollView style={styles.pageContainer}>
            <Text style={styles.pageTitle}>{isReturnMode ? '우산 반납' : '우산 대여'}</Text>
            <Text style={styles.subTitle}>대여소 번호: {selectedStationId}</Text>
            
            {isReturnMode ? (
                // 반납 모드일 때 화면
                <View style={styles.centerContent}>
                    <Text style={{fontSize:18, marginBottom:20}}>반납하시겠습니까?</Text>
                    <TouchableOpacity style={[styles.actionButton, {backgroundColor:'#dc3545'}]} onPress={handleReturn}>
                        <Text style={styles.whiteText}>반납하기</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                // 대여 모드일 때 화면 (우산 목록 표시)
                <View>
                    {availableUmbrella.length > 0 ? availableUmbrella.map((u, i) => (
                        <View key={i} style={styles.listItem}>
                            <Text>우산 ID: {u.umbrella_id}</Text>
                            <TouchableOpacity style={styles.smallBtn} onPress={() => handleRent(u.umbrella_id)}>
                                <Text style={styles.whiteText}>대여</Text>
                            </TouchableOpacity>
                        </View>
                    )) : <Text style={{textAlign:'center', marginTop:20}}>대여 가능한 우산이 없습니다.</Text>}
                </View>
            )}
            <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]} onPress={() => setActiveTab('map')}>
                <Text style={styles.secondaryButtonText}>지도로 돌아가기</Text>
            </TouchableOpacity>
        </ScrollView>
    );

    // [마이페이지 탭] 렌더링 함수
    const renderMyTab = () => (
        <ScrollView style={styles.pageContainer}>
            <Text style={styles.pageTitle}>마이 페이지</Text>
            {isLoggedIn ? (
                // 로그인 상태: 사용자 정보 표시
                <View style={styles.centerContent}>
                    <Icon name="user-circle" size={80} color="#38b438" />
                    <Text style={styles.userName}>{userInfo?.nickname || '사용자'} 님</Text>
                    <Text>{userInfo?.email}</Text>
                    <TouchableOpacity style={[styles.actionButton, styles.secondaryButton, {marginTop:20}]} onPress={handleLogout}>
                        <Text style={styles.secondaryButtonText}>로그아웃</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                // 비로그인 상태: 로그인/회원가입 폼 표시
                <View style={styles.loginFormContainer}>
                    <Text style={styles.formTitle}>{isSignup ? '회원가입' : '로그인'}</Text>
                    {isSignup && (
                        <>
                            <View style={{flexDirection:'row', alignItems:'center'}}>
                                <TextInput style={[styles.loginInput, {flex:1}]} placeholder="ID" value={loginForm.emailPrefix} onChangeText={t=>setLoginForm({...loginForm, emailPrefix:t})} />
                                <Text> @ </Text>
                                <TextInput style={[styles.loginInput, {flex:1}]} placeholder="도메인" value={loginForm.emailDomain} onChangeText={t=>setLoginForm({...loginForm, emailDomain:t})} />
                            </View>
                            <TextInput style={styles.loginInput} placeholder="닉네임" value={loginForm.nickname} onChangeText={t=>setLoginForm({...loginForm, nickname:t})} />
                            <TextInput style={styles.loginInput} placeholder="전화번호" keyboardType="numeric" value={loginForm.phone} onChangeText={t=>setLoginForm({...loginForm, phone:t})} />
                        </>
                    )}
                    {!isSignup && <TextInput style={styles.loginInput} placeholder="이메일" value={loginForm.email} onChangeText={t=>setLoginForm({...loginForm, email:t})} />}
                    <TextInput style={styles.loginInput} placeholder="비밀번호" secureTextEntry value={loginForm.password} onChangeText={t=>setLoginForm({...loginForm, password:t})} />
                    {isSignup && <TextInput style={styles.loginInput} placeholder="비밀번호 확인" secureTextEntry value={loginForm.passwordConfirm} onChangeText={t=>setLoginForm({...loginForm, passwordConfirm:t})} />}
                    
                    <Text style={{color:'red', textAlign:'center'}}>{authError}</Text>
                    
                    <TouchableOpacity style={[styles.actionButton, styles.primaryButton]} onPress={() => handleAuth(isSignup)}>
                        <Text style={styles.whiteText}>{isSignup ? '가입완료' : '로그인'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{marginTop:10, alignItems:'center'}} onPress={() => setIsSignup(!isSignup)}>
                        <Text style={{color:'#555'}}>{isSignup ? '로그인 하러가기' : '회원가입 하기'}</Text>
                    </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    );

    // [즐겨찾기 탭] 렌더링 함수
    const renderFavoritesTab = () => (
        <ScrollView style={styles.pageContainer}>
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
                <Text style={styles.pageTitle}>즐겨찾기</Text>
                <TouchableOpacity onPress={() => setIsDeleteMode(!isDeleteMode)}>
                    <Text style={{color: isDeleteMode ? 'green' : 'red'}}>{isDeleteMode ? '완료' : '삭제관리'}</Text>
                </TouchableOpacity>
            </View>
            {favorites.map((fav, i) => (
                <View key={i} style={styles.listItem}>
                    <TouchableOpacity style={{flex:1, flexDirection:'row', alignItems:'center'}} onPress={() => {
                        if(!isDeleteMode) { setMapRegion(prev => ({...prev, latitude: fav.latitude, longitude: fav.longitude})); setActiveTab('map'); }
                    }}>
                        <Icon name="star" size={20} color="#FFD700" />
                        <Text style={{marginLeft:10, fontSize:16}}>{fav.station_name}</Text>
                    </TouchableOpacity>
                    {isDeleteMode && (
                        <TouchableOpacity onPress={async () => {
                            await fetch(`${BACKEND_URL}/api/favorites?station_id=${fav.station_id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${userToken}` } });
                            fetchFavorites();
                        }}>
                            <Icon name="minus-circle" size={24} color="red" />
                        </TouchableOpacity>
                    )}
                </View>
            ))}
            {favorites.length === 0 && <Text style={{textAlign:'center'}}>즐겨찾기 목록이 비어있습니다.</Text>}
        </ScrollView>
    );

    // [최종 렌더링] 전체 화면 레이아웃을 구성합니다.

    return (
        <View style={styles.mapContainer}>
            {/* 메인 콘텐츠 영역 (탭에 따라 내용이 바뀜) */}
            <View style={styles.contentArea}>
                {activeTab === 'map' && renderMapTab()}
                {activeTab === 'rental' && renderRentalTab()}
                {activeTab === 'my' && renderMyTab()}
                {activeTab === 'favorites' && renderFavoritesTab()}
            </View>

            {/* 하단 네비게이션 바 (Bottom Tab) */}
            <View style={styles.footer}>
                <View style={styles.navButtons}>
                    <TouchableOpacity style={styles.navButton} onPress={() => setActiveTab('my')}>
                        <Icon name="user" size={24} color={activeTab === 'my' ? '#38b438' : '#888'} />
                        <Text style={[styles.navButtonText, activeTab === 'my' && {color:'#38b438'}]}>MY</Text>
                    </TouchableOpacity>
                    <View style={styles.navPlaceholder} />
                    <TouchableOpacity style={styles.navButton} onPress={() => setActiveTab('favorites')}>
                        <Icon name="star" size={24} color={activeTab === 'favorites' ? '#38b438' : '#888'} />
                        <Text style={[styles.navButtonText, activeTab === 'favorites' && {color:'#38b438'}]}>즐겨찾기</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* 중앙 원형 버튼 (홈/QR) */}
            <View style={styles.centerButtonWrapper}>
                <TouchableOpacity style={styles.centerRoundButton} onPress={() => {
                    // 지도 화면에서는 대여 페이지로, 다른 화면에서는 지도로 이동
                    if (activeTab === 'map') navigateToRentalPage(null);
                    else setActiveTab('map');
                }}>
                    <Icon name={activeTab === 'map' ? "qrcode" : "home"} size={30} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );
};


// 스타일 정의 (CSS)

const styles = StyleSheet.create({
    splashContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#38b438' },
    splashText: { fontSize: 30, fontWeight: 'bold', color: '#fff' },
    mapContainer: { flex: 1, backgroundColor: '#fff' },
    contentArea: { flex: 1 },
    map: { flex: 1 },
    mapView: { flex: 1 },
    
    // 검색창 및 오버레이 스타일
    headerOverlay: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', zIndex: 10, alignItems:'center' },
    searchInput: { flex: 1, backgroundColor: 'white', padding: 10, borderRadius: 5, elevation: 5 },
    searchBtn: { backgroundColor: '#38b438', padding: 12, borderRadius: 5, marginLeft: 5, elevation: 5 },
    nearbyBtn: { padding: 12, borderRadius: 5, marginLeft: 5, elevation: 5 },
    nearbyListContainer: { position:'absolute', top: 60, left:10, right:10, backgroundColor:'white', zIndex:10, borderRadius:5, elevation:5, padding:5 },
    nearbyItem: { padding: 10, borderBottomWidth:1, borderColor:'#eee' },
    
    // 하단 네비게이션 스타일
    footer: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', paddingBottom: Platform.OS === 'ios' ? 20 : 0 },
    navButtons: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', height: 60, paddingHorizontal: 20 },
    navButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    navButtonText: { fontSize: 12, marginTop: 2, color: '#888' },
    navPlaceholder: { width: 80 }, 
    centerButtonWrapper: { position: 'absolute', bottom: 30, left: '50%', marginLeft: -35, zIndex: 10 },
    centerRoundButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#38b438', justifyContent: 'center', alignItems: 'center', elevation: 5 },
    
    // 공통 페이지 스타일
    pageContainer: { flex: 1, padding: 20 },
    pageTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#38b438' },
    subTitle: { fontSize: 18, marginBottom: 10 },
    actionButton: { padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    primaryButton: { backgroundColor: '#38b438' },
    secondaryButton: { borderWidth: 1, borderColor: '#38b438', marginTop: 10 },
    whiteText: { color: '#fff', fontWeight: 'bold' },
    secondaryButtonText: { color: '#38b438', fontWeight: 'bold' },
    
    // 리스트 및 폼 스타일
    listItem: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderColor: '#eee', alignItems: 'center', justifyContent: 'space-between' },
    smallBtn: { backgroundColor: '#38b438', padding: 5, borderRadius: 3 },
    loginFormContainer: { padding: 20, borderWidth: 1, borderColor: '#eee', borderRadius: 8 },
    formTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#38b438' },
    loginInput: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 5, marginBottom: 10 },
    centerContent: { alignItems: 'center', justifyContent: 'center', flex: 1 },
    userName: { fontSize: 20, fontWeight: 'bold', marginTop: 10 },
});

export default MapComponent;
