import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { loadCurrentUser, logoutUser } from './src/services/storageService';
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import UserWirdScreen from './src/screens/UserWirdScreen';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);
  const [isSplashDone, setIsSplashDone] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const user = await loadCurrentUser();
      setCurrentUser(user);
    } catch (e) {
      console.error('Error loading current user:', e);
    } finally {
      setIsAuthLoaded(true);
    }
  };

  const handleLoginSuccess = (userSession) => {
    setCurrentUser(userSession);
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
  };

  // 1. عرض شاشة الـ Splash الفاخرة للعمامة المحنكة و"زاد الأنصاري - مشورة إب"
  if (!isSplashDone) {
    return <SplashScreen onFinish={() => setIsSplashDone(true)} />;
  }

  // 2. شاشة الانتظار الخفيفة أثناء فحص جلسة الدخول إن لزم
  if (!isAuthLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  // 3. إذا لم يكن هناك تسجيل دخول، عرض شاشة الدخول
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // 4. إذا كان المستخدم مديراً
  if (currentUser.role === 'admin') {
    return <HomeScreen onLogout={handleLogout} />;
  }

  // 5. إذا كان مستخدماً عادياً (قارئاً في المجموعة)
  return (
    <UserWirdScreen
      currentUser={currentUser}
      onLogout={handleLogout}
      onUserUpdated={(updatedUser) => setCurrentUser(updatedUser)}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#064E3B',
    justifyContent: 'center',
    alignItems: 'center',
  },
});