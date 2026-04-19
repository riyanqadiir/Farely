import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  Slide1Illustration,
  Slide2Illustration,
  Slide3Illustration,
} from '../components/OnboardingIllustration';
import { colors, spacing, typography } from '../constants/theme';

const { width } = Dimensions.get('window');
const PRIMARY = colors.primary;

const SLIDES = [
  {
    id: '1',
    headline: 'Anywhere you are',
    description: 'Compare ride fares and ETAs across Careem, Yango, inDrive, and Bykea—all in one place.',
    Illustration: Slide1Illustration,
  },
  {
    id: '2',
    headline: 'At anytime',
    description: 'Get real-time fare estimates whenever you need a ride. No more switching between apps.',
    Illustration: Slide2Illustration,
  },
  {
    id: '3',
    headline: 'Book your car',
    description: 'Pick the best option, pay from your wallet, and go. Simple, transparent, and convenient.',
    Illustration: Slide3Illustration,
    isLast: true,
  },
];

const OnboardingScreen = ({ navigation }) => {
  const flatListRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const completeOnboarding = async () => {
    await AsyncStorage.setItem('onboardingSeen', 'true');
    navigation.replace('Welcome');
  };

  const handleNext = () => {
    const slide = SLIDES[currentIndex];
    if (slide?.isLast) {
      completeOnboarding();
      return;
    }
    const nextIndex = currentIndex + 1;
    if (nextIndex < SLIDES.length) {
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }
  };

  const handleSkip = () => {
    completeOnboarding();
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderSlide = ({ item }) => (
    <View style={styles.slide}>
      <View style={styles.illustrationContainer}>
        <item.Illustration />
      </View>
      <Text style={styles.headline}>{item.headline}</Text>
      <Text style={styles.description}>{item.description}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <TouchableOpacity style={styles.skip} onPress={handleSkip} activeOpacity={0.7}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        scrollEventThrottle={16}
        bounces={false}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          {SLIDES[currentIndex]?.isLast ? (
            <Text style={styles.nextButtonText}>Go</Text>
          ) : (
            <Ionicons name="arrow-forward" size={28} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  skip: {
    position: 'absolute',
    top: spacing.md + 40,
    right: spacing.lg,
    zIndex: 10,
  },
  skipText: { fontSize: 16, color: colors.gray500, fontWeight: '500' },
  slide: {
    width,
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl * 2,
    alignItems: 'center',
  },
  illustrationContainer: {
    marginBottom: spacing.xl,
    minHeight: 220,
    justifyContent: 'center',
  },
  headline: {
    ...typography.headline,
    fontSize: 26,
    color: colors.gray900,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  description: {
    ...typography.caption,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl + 20,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PRIMARY,
  },
  dotActive: { opacity: 1, width: 24 },
  dotInactive: { opacity: 0.3 },
  nextButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
});

export default OnboardingScreen;
