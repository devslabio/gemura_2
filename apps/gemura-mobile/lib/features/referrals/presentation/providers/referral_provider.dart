import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/models/referral_code.dart';
import '../../domain/models/referral_stats.dart';
import '../../domain/models/points_balance.dart';
import '../../domain/models/onboarded_user.dart';
import '../../data/services/referral_service.dart';

// Referral Code State
class ReferralCodeState {
  final ReferralCode? referralCode;
  final bool isLoading;
  final String? error;

  const ReferralCodeState({
    this.referralCode,
    this.isLoading = false,
    this.error,
  });

  ReferralCodeState copyWith({
    ReferralCode? referralCode,
    bool? isLoading,
    String? error,
  }) {
    return ReferralCodeState(
      referralCode: referralCode ?? this.referralCode,
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
    );
  }
}

class ReferralCodeNotifier extends StateNotifier<ReferralCodeState> {
  ReferralCodeNotifier() : super(const ReferralCodeState());

  Future<void> getReferralCode() async {
    state = state.copyWith(isLoading: true, error: null);
    
    try {
      final response = await ReferralService.getReferralCode();
      
      if (response['code'] == 200) {
        final referralCode = ReferralCode.fromJson(response['data']);
        state = state.copyWith(
          referralCode: referralCode,
          isLoading: false,
        );
      } else {
        state = state.copyWith(
          isLoading: false,
          error: response['message'] ?? 'Failed to get referral code',
        );
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Error getting referral code: $e',
      );
    }
  }
}

// Referral Stats State
class ReferralStatsState {
  final ReferralStats? stats;
  final bool isLoading;
  final String? error;

  const ReferralStatsState({
    this.stats,
    this.isLoading = false,
    this.error,
  });

  ReferralStatsState copyWith({
    ReferralStats? stats,
    bool? isLoading,
    String? error,
  }) {
    return ReferralStatsState(
      stats: stats ?? this.stats,
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
    );
  }
}

class ReferralStatsNotifier extends StateNotifier<ReferralStatsState> {
  ReferralStatsNotifier() : super(const ReferralStatsState());

  Future<void> getReferralStats() async {
    state = state.copyWith(isLoading: true, error: null);
    
    try {
      final response = await ReferralService.getReferralStats();
      
      if (response['code'] == 200) {
        final stats = ReferralStats.fromJson(response['data']);
        state = state.copyWith(
          stats: stats,
          isLoading: false,
        );
      } else {
        state = state.copyWith(
          isLoading: false,
          error: response['message'] ?? 'Failed to get referral stats',
        );
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Error getting referral stats: $e',
      );
    }
  }
}

// Points Balance State
class PointsBalanceState {
  final PointsBalance? balance;
  final bool isLoading;
  final String? error;

  const PointsBalanceState({
    this.balance,
    this.isLoading = false,
    this.error,
  });

  PointsBalanceState copyWith({
    PointsBalance? balance,
    bool? isLoading,
    String? error,
  }) {
    return PointsBalanceState(
      balance: balance ?? this.balance,
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
    );
  }
}

class PointsBalanceNotifier extends StateNotifier<PointsBalanceState> {
  PointsBalanceNotifier() : super(const PointsBalanceState());

  Future<void> getPointsBalance() async {
    state = state.copyWith(isLoading: true, error: null);
    
    try {
      final response = await ReferralService.getPointsBalance();
      
      if (response['code'] == 200) {
        final balance = PointsBalance.fromJson(response['data']);
        state = state.copyWith(
          balance: balance,
          isLoading: false,
        );
      } else {
        state = state.copyWith(
          isLoading: false,
          error: response['message'] ?? 'Failed to get points balance',
        );
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Error getting points balance: $e',
      );
    }
  }
}

// Onboard User State
class OnboardUserState {
  final OnboardedUser? onboardedUser;
  final bool isLoading;
  final String? error;

  const OnboardUserState({
    this.onboardedUser,
    this.isLoading = false,
    this.error,
  });

  OnboardUserState copyWith({
    OnboardedUser? onboardedUser,
    bool? isLoading,
    String? error,
  }) {
    return OnboardUserState(
      onboardedUser: onboardedUser ?? this.onboardedUser,
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
    );
  }
}

class OnboardUserNotifier extends StateNotifier<OnboardUserState> {
  OnboardUserNotifier() : super(const OnboardUserState());

  Future<void> onboardUser({
    required String firstName,
    required String lastName,
    required String phoneNumber,
    required String password,
    String? email,
    String? location,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    
    try {
      final response = await ReferralService.onboardUser(
        firstName: firstName,
        lastName: lastName,
        phoneNumber: phoneNumber,
        password: password,
        email: email,
        location: location,
      );
      
      if (response['code'] == 201) {
        final onboardedUser = OnboardedUser.fromJson(response['data']);
        state = state.copyWith(
          onboardedUser: onboardedUser,
          isLoading: false,
        );
      } else {
        state = state.copyWith(
          isLoading: false,
          error: response['message'] ?? 'Failed to onboard user',
        );
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Error onboarding user: $e',
      );
    }
  }

  void clearState() {
    state = const OnboardUserState();
  }
}

// Providers
final referralCodeProvider = StateNotifierProvider<ReferralCodeNotifier, ReferralCodeState>((ref) {
  return ReferralCodeNotifier();
});

final referralStatsProvider = StateNotifierProvider<ReferralStatsNotifier, ReferralStatsState>((ref) {
  return ReferralStatsNotifier();
});

final pointsBalanceProvider = StateNotifierProvider<PointsBalanceNotifier, PointsBalanceState>((ref) {
  return PointsBalanceNotifier();
});

final onboardUserProvider = StateNotifierProvider<OnboardUserNotifier, OnboardUserState>((ref) {
  return OnboardUserNotifier();
});
