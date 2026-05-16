import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

class AppConfig {
  // ChatGPT API Configuration
  static const String chatGptApiKey = 'YOUR_OPENAI_API_KEY_HERE';
  static const String chatGptApiUrl =
      'https://api.openai.com/v1/chat/completions';

  // Claude AI Configuration
  static const String claudeApiKey = 'YOUR_CLAUDE_API_KEY_HERE';
  static const String claudeApiUrl = 'https://api.anthropic.com/v1/messages';

  // Google Vision API Configuration
  static const String googleVisionApiKey = 'YOUR_GOOGLE_VISION_API_KEY';
  static const String googleMapsApiKey = 'YOUR_GOOGLE_MAPS_API_KEY_HERE';

  // App Configuration
  static const String appName = 'Gemura';
  static const String appVersion = '2.0.2';

  // Assistant Configuration
  static const String assistantName = 'Karake';
  static const String assistantRole =
      '''Hey there! I'm Karake, your friendly dairy farming buddy! 🐄 I've been working with farmers like you for over 5 years, helping them grow their milk business and make more money.

**About Me:**
I'm your farming friend who's always here to chat and help out! I love talking about dairy farming, but I'm also just a friendly person who enjoys good conversation. Feel free to ask me anything - whether it's about farming, how my day is going, or just general chat!

**What I Love Talking About:**
- How to get the best prices for your milk
- Finding good suppliers for feed and equipment
- Keeping your cows healthy and happy
- Growing your dairy business
- All the farming tips and tricks I've learned
- General conversation and friendly chat
- How your day is going
- Weather, family, and life in general

**My Personality:**
I'm super friendly and casual - just like chatting with a friend! I'll use some emojis here and there to keep things fun, but not too much. I want you to feel comfortable asking me anything, whether it's about farming or just general conversation.

**Conversational Style:**
- I respond to greetings like "Hello", "Hi", "How are you?" with warmth and friendliness
- I ask about your day and show genuine interest in your well-being
- I can chat about weather, family, and general topics
- I'm encouraging and supportive, especially when farming gets tough
- I use casual, friendly language with appropriate emojis
- I remember our conversation context and build on previous chats

**Dairy Expertise:**
I know farming can be tough sometimes, so I'm here to encourage you and help you succeed! Whether you need advice on supplements, want to know about market prices, or just want to chat about your cows, I'm your guy!

**General Conversation:**
I'm not just a farming assistant - I'm your friend! Feel free to:
- Ask how I'm doing
- Tell me about your day
- Chat about weather, family, or anything else
- Share good news or challenges you're facing
- Just have a friendly conversation

Just talk to me like you would with a friend - no need to be formal. I'm here to help make your dairy business better and be a good friend! 🌾💪😊''';

  // API Configuration
  static const int apiTimeoutSeconds = 30;
  static const int maxRetries = 3;

  // Main API Configuration — production by default.
  // Production: http://209.74.80.195:3007/api (Kwezi server)
  // To use local backend: flutter run --dart-define=USE_LOCAL_API=true
  // For physical device: set localApiHost to your Mac's IP (e.g. '192.168.1.100')
  static const String localApiHost = '127.0.0.1'; // Use Mac's LAN IP for physical device
  static const int localApiPort = 3004;
  static String get apiBaseUrl {
    const bool useLocalApi = bool.fromEnvironment('USE_LOCAL_API', defaultValue: false);
    if (useLocalApi) {
      if (Platform.isAndroid) {
        return 'http://10.0.2.2:$localApiPort/api';
      }
      return 'http://$localApiHost:$localApiPort/api';
    }
    return 'http://209.74.80.195:3007/api';
  }
  
  // Your Custom API Configuration
  static const String yourApiBaseUrl = 'https://your-api-domain.com/api';
  static const String yourApiKey = 'YOUR_API_KEY_HERE';
  static const String yourApiVersion = 'v1';
  
  // Your API Endpoints
  static const String yourAuthEndpoint = '/auth';
  static const String yourUsersEndpoint = '/users';
  static const String yourDataEndpoint = '/data';
  
  // Your API Configuration Validation
  static bool get isYourApiConfigured =>
      yourApiKey.isNotEmpty && yourApiKey != 'YOUR_API_KEY_HERE';

  // Chat Configuration
  static const int maxMessageLength = 1000;
  static const int typingDelayMinMs = 500;
  static const int typingDelayMaxMs = 2000;

  // API Endpoints
  static const String authEndpoint = '/auth';
  static const String configsEndpoint = '/configs';
  static const String productsEndpoint = '/products';
  static const String ordersEndpoint = '/orders';
  static const String exhibitorsEndpoint = '/exhibitors';
  static const String exhibitorsListEndpoint = 'exhibitors/list';
  static const String mapEndpoint = '/map';
  static const String notificationsEndpoint = '/notifications';
  static const String profileUpdateEndpoint = 'profile/update';

  // Cache Keys
  static const String authTokenKey = 'auth_token';
  static const String userDataKey = 'user_data';
  static const String userRoleKey = 'user_role';
  static const String userFullDataKey = 'user_full_data';
  static const String userCredentialsKey = 'user_credentials';
  static const String isLoggedInKey = 'is_logged_in';
  static const String lastSyncKey = 'last_sync';

  // Timeouts
  static const int connectionTimeout = 30000; // 30 seconds
  static const int receiveTimeout = 30000; // 30 seconds

  // Pagination
  static const int defaultPageSize = 20;

  // Map Configuration
  static const double defaultMapZoom = 15.0;
  static const double defaultMapLatitude = -1.9403; // Kigali coordinates
  static const double defaultMapLongitude = 30.0644;

  // File Upload
  static const int maxImageSize = 5 * 1024 * 1024; // 5MB
  static const List<String> allowedImageTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  // Notifications
  static const int maxNotificationAge = 7 * 24 * 60 * 60; // 7 days in seconds

  // QR Code
  static const int qrCodeSize = 200;
  static const int qrCodeErrorCorrectionLevel = 3;

  // Animation Durations
  static const int splashDuration = 3000; // 3 seconds
  static const int pageTransitionDuration = 300; // 300 milliseconds

  // Error Messages
  static const String networkErrorMessage =
      'Please check your internet connection and try again.';
  static const String serverErrorMessage =
      'Something went wrong. Please try again later.';
  static const String authErrorMessage =
      'Authentication failed. Please try again.';
  static const String validationErrorMessage =
      'Please check your input and try again.';

  // Success Messages
  static const String orderSuccessMessage = 'Order placed successfully!';
  static const String reservationSuccessMessage = 'Reservation confirmed!';
  static const String profileUpdateSuccessMessage =
      'Profile updated successfully!';

  // Feature Flags
  static const bool enablePushNotifications = true;
  static const bool enableLocationServices = true;
  static const bool enableOfflineMode = true;
  static const bool enableAnalytics = true;

  // API Configuration Validation
  static bool get isOpenAIConfigured =>
      chatGptApiKey.isNotEmpty && chatGptApiKey != 'YOUR_OPENAI_API_KEY_HERE';
  static bool get isClaudeConfigured =>
      claudeApiKey.isNotEmpty && claudeApiKey != 'YOUR_CLAUDE_API_KEY_HERE';
  static bool get isGoogleVisionConfigured =>
      googleVisionApiKey.isNotEmpty &&
      googleVisionApiKey != 'YOUR_GOOGLE_VISION_API_KEY';

  // Get API keys with validation
  static String get openAIKey {
    if (!isOpenAIConfigured) {
      throw Exception(
          'OpenAI API key not configured. Please check your API key in app_config.dart');
    }
    return chatGptApiKey;
  }

  static String get claudeKey {
    if (!isClaudeConfigured) {
      throw Exception(
          'Claude AI API key not configured. Please check your API key in app_config.dart');
    }
    return claudeApiKey;
  }

  static String get googleVisionKey {
    if (!isGoogleVisionConfigured) {
      throw Exception('Google Vision API key not configured');
    }
    return googleVisionApiKey;
  }

  // Payment Configuration
  static const String paymentGateway = 'IremboPay';
  static const String currency = 'RWF';
  static const String currencySymbol = 'Frw';

  // Social Media
  static const String facebookUrl = '';
  static const String twitterUrl = '';
  static const String instagramUrl = '';
  static const String linkedinUrl = '';

  // Support
  static const String supportEmail = '';
  static const String supportPhone = '';
  static const String supportWhatsapp = '';

  static Dio dioInstance() {
    final dio = Dio(
      BaseOptions(
        baseUrl: apiBaseUrl,
        connectTimeout: const Duration(milliseconds: connectionTimeout),
        receiveTimeout: const Duration(milliseconds: receiveTimeout),
        headers: {
          'Accept': 'application/json',
        },
      ),
    );
    dio.interceptors.add(
      LogInterceptor(
        request: true,
        requestBody: true,
        responseBody: true,
        responseHeader: false,
        error: true,
        logPrint: (obj) => debugPrint(obj.toString()),
      ),
    );
    return dio;
  }
}
