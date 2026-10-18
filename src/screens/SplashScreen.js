import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  SafeAreaView,
  StatusBar,
  Dimensions,
  TouchableOpacity,
} from 'react-native';

const { width } = Dimensions.get('window');

export default function SplashScreen({ onFinish }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // تشغيل الحركة المتناسقة (Fade in + Scale + Slide up)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // الانتقال التلقائي السلس بعد 2.8 ثانية
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, 2800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#064E3B" />

      {/* لمس الشاشة للتخطي الفوري */}
      <TouchableOpacity
        style={styles.touchArea}
        activeOpacity={1}
        onPress={() => onFinish && onFinish()}
      >
        {/* البسملة التزيينية في الأعلى */}
        <Animated.View style={[styles.topBanner, { opacity: fadeAnim }]}>
          <Text style={styles.bismillah}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
        </Animated.View>

        {/* الكتلة المركزية لشعار واسم التطبيق */}
        <Animated.View
          style={[
            styles.centerContent,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
            },
          ]}
        >
          {/* إطار دائري فاخر لصورة العمامة المحنكة */}
          <View style={styles.logoMedallionOuter}>
            <View style={styles.logoMedallionInner}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* اسم التطبيق الفاخر */}
          <Text style={styles.appTitle}>زاد الأنصاري</Text>

          {/* تحت اسم التطبيق: مشورة إب */}
          <View style={styles.subtitleBadge}>
            <Text style={styles.subtitleText}>« مشورة إب »</Text>
          </View>

          {/* الآية القرآنية الكريمة */}
          <View style={styles.ayahBox}>
            <Text style={styles.ayahText}>
              ﴿ وَتَزَوَّدُوا فَإِنَّ خَيْرَ الزَّادِ التَّقْوَىٰ ﴾
            </Text>
            <Text style={styles.surahRef}>سورة البقرة: ١٩٧</Text>
          </View>
        </Animated.View>

        {/* التذييل ومؤشر التحميل */}
        <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
          <View style={styles.dotsRow}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
          <Text style={styles.footerNote}>حلقة الورد القرآني المباركة</Text>
        </Animated.View>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#064E3B', // خلفية الزمرد الفاخر
  },
  touchArea: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  topBanner: {
    alignItems: 'center',
    marginTop: 10,
  },
  bismillah: {
    fontSize: 16,
    color: '#FDE68A',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  centerContent: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
  },
  logoMedallionOuter: {
    width: 146,
    height: 146,
    borderRadius: 73,
    backgroundColor: 'rgba(212, 175, 55, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D4AF37',
    marginBottom: 20,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  logoMedallionInner: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  logoImage: {
    width: 110,
    height: 110,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  subtitleBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.45)',
  },
  subtitleText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6EE7B7', // زمردي فاتح جذاب
    letterSpacing: 0.5,
  },
  ayahBox: {
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
  },
  ayahText: {
    fontSize: 14,
    color: '#FDE68A',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
  surahRef: {
    fontSize: 11,
    color: '#A7F3D0',
    marginTop: 4,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  dotsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  dotActive: {
    backgroundColor: '#F59E0B',
    width: 22,
    borderRadius: 4,
  },
  footerNote: {
    fontSize: 12,
    color: '#A7F3D0',
    fontWeight: '600',
  },
});
