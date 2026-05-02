import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/providers/localization_provider.dart';
import '../../../../core/services/location_service.dart';
import '../../domain/models/product.dart';
import '../providers/products_provider.dart';
import 'product_details_screen.dart';
import '../../../chat/presentation/screens/chat_screen.dart';
import '../../../chat/domain/models/chat_room.dart';
import '../../../../shared/models/wallet.dart';

class UserProfileScreen extends ConsumerStatefulWidget {
  final TopSeller user;

  const UserProfileScreen({
    super.key,
    required this.user,
  });

  @override
  ConsumerState<UserProfileScreen> createState() => _UserProfileScreenState();
}

class _UserProfileScreenState extends ConsumerState<UserProfileScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isFollowing = false;
  String? _distanceFromUser;
  bool _isLoadingDistance = false;
  int _followerCount = 0;
  String _chartPeriod = 'Day'; // 'Day', 'Week', 'Month'

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    // Simulate initial follower count
    _followerCount = widget.user.totalSales ~/ 10; // Rough estimate
    _calculateDistance();
  }

  Future<void> _calculateDistance() async {
    setState(() {
      _isLoadingDistance = true;
    });

    try {
      // Try to get real distance using location service
      final locationService = LocationService.instance;
      final realDistance = await locationService.getDistanceFromCurrentLocation(
        widget.user.location, // Assuming location contains coordinates
      );
      
      if (realDistance != null) {
        setState(() {
          _distanceFromUser = realDistance;
        });
      } else {
        // Fallback to static distance if real location is not available
        final locationName = _getLocationName(widget.user.location);
        final staticDistance = _getStaticDistanceForLocation(locationName);
        setState(() {
          _distanceFromUser = staticDistance;
        });
      }
    } catch (e) {
      print('Error calculating distance: $e');
      // Fallback to static distance on error
      final locationName = _getLocationName(widget.user.location);
      final staticDistance = _getStaticDistanceForLocation(locationName);
      setState(() {
        _distanceFromUser = staticDistance;
      });
    } finally {
      setState(() {
        _isLoadingDistance = false;
      });
    }
  }

  String _getLocationName(String coordinates) {
    // Map coordinates to location names
    final locationMap = {
      '-1.9441,30.0619': 'Kigali, Rwanda',
      '-1.4998,29.6344': 'Musanze, Rwanda',
      '-1.6936,29.2356': 'Rubavu, Rwanda',
      '-2.6031,29.7439': 'Huye, Rwanda',
      '-1.3048,30.3285': 'Nyagatare, Rwanda',
    };
    
    return locationMap[coordinates] ?? coordinates;
  }

  String _getStaticDistanceForLocation(String location) {
    // Static distance data for different locations in Rwanda
    final staticDistances = {
      'Kigali, Rwanda': '1.2km',
      'Nyarugenge, Kigali': '0.8km',
      'Kacyiru, Kigali': '2.1km',
      'Kimisagara, Kigali': '1.5km',
      'Nyamirambo, Kigali': '3.2km',
      'Rwamagana, Eastern Province': '45.3km',
      'Musanze, Northern Province': '78.9km',
      'Huye, Southern Province': '125.6km',
      'Rubavu, Western Province': '89.4km',
      'Gicumbi, Northern Province': '67.8km',
    };
    
    // Check for exact match first
    if (staticDistances.containsKey(location)) {
      return staticDistances[location]!;
    }
    
    // Check for partial matches (e.g., if location contains "Kigali")
    if (location.toLowerCase().contains('kigali')) {
      return '2.5km';
    } else if (location.toLowerCase().contains('rwamagana')) {
      return '45.3km';
    } else if (location.toLowerCase().contains('musanze')) {
      return '78.9km';
    } else if (location.toLowerCase().contains('huye')) {
      return '125.6km';
    } else if (location.toLowerCase().contains('rubavu')) {
      return '89.4km';
    } else if (location.toLowerCase().contains('gicumbi')) {
      return '67.8km';
    }
    
    // Default distance for any other location
    return '6.0km';
  }


  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _openChatWithUser() {
    // Create a simple chat room for the seller without wallet integration
    final chatRoom = ChatRoom(
      id: 'USER-${widget.user.id}',
      name: widget.user.name,
      description: 'Chat with ${widget.user.name}',
      walletId: '', // No wallet integration
      wallet: Wallet(
        id: '',
        name: '',
        balance: 0,
        currency: 'RWF',
        type: 'personal',
        status: 'active',
        createdAt: DateTime.now(),
        owners: [],
        isDefault: false,
        description: '',
      ),
      members: [
        ChatMember(
          id: 'USER-CURRENT',
          name: 'You',
          email: 'user@example.com',
          role: 'member',
          joinedAt: DateTime.now(),
          isOnline: true,
        ),
        ChatMember(
          id: widget.user.id.toString(),
          name: widget.user.name,
          email: widget.user.email ?? '${widget.user.code}@user.com',
          avatar: widget.user.imageUrl,
          role: 'system_admin',
          joinedAt: DateTime.now(),
          isOnline: true,
        ),
      ],
      createdAt: DateTime.now(),
      isActive: true,
      groupAvatar: widget.user.imageUrl,
    );

    // Navigate to the existing chat screen
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => ChatScreen(chatRoom: chatRoom),
      ),
    );
  }

  void _makeCallToUser() {
    if (widget.user.phone != null && widget.user.phone!.isNotEmpty) {
      // Show call options dialog
      showModalBottomSheet(
        context: context,
        backgroundColor: AppTheme.surfaceColor,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppTheme.borderRadius16),
          ),
        ),
        builder: (context) => Container(
          padding: const EdgeInsets.all(AppTheme.spacing16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppTheme.textSecondaryColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: AppTheme.spacing16),
              Text(
                'Call ${widget.user.name}',
                style: AppTheme.titleMedium.copyWith(
                  color: AppTheme.textPrimaryColor,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: AppTheme.spacing8),
              Text(
                widget.user.phone!,
                style: AppTheme.bodyMedium.copyWith(
                  color: AppTheme.textSecondaryColor,
                ),
              ),
              const SizedBox(height: AppTheme.spacing24),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(
                          color: AppTheme.thinBorderColor,
                          width: AppTheme.thinBorderWidth,
                        ),
                        padding: const EdgeInsets.symmetric(vertical: AppTheme.spacing12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppTheme.borderRadius8),
                        ),
                      ),
                      child: Text(
                        'Cancel',
                        style: AppTheme.bodyMedium.copyWith(
                          color: AppTheme.textPrimaryColor,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: AppTheme.spacing12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.pop(context);
                        // Here you would implement the actual call functionality
                        // For now, we'll just show a success message
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Calling ${widget.user.name}...'),
                            backgroundColor: AppTheme.primaryColor,
                          ),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primaryColor,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: AppTheme.spacing12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppTheme.borderRadius8),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.phone, size: 18),
                          const SizedBox(width: AppTheme.spacing4),
                          Text(
                            'Call',
                            style: AppTheme.bodyMedium.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
    } else {
      // Show error if no phone number
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('No phone number available for ${widget.user.name}'),
          backgroundColor: AppTheme.errorColor,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final localizationService = ref.watch(localizationServiceProvider);

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: AppBar(
        backgroundColor: AppTheme.surfaceColor,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          widget.user.name,
          style: AppTheme.titleMedium.copyWith(
            fontWeight: FontWeight.w600,
            color: AppTheme.textPrimaryColor,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.more_vert),
            onPressed: () {
              _showMoreOptions(context);
            },
          ),
        ],
      ),
      body: CustomScrollView(
        slivers: [
          // Profile Header
          SliverToBoxAdapter(
            child: _buildProfileHeader(),
          ),
          // Stats and Follow Button
          SliverToBoxAdapter(
            child: _buildStatsAndActions(),
          ),
          // Bio Section
          SliverToBoxAdapter(
            child: _buildBioSection(),
          ),
          // Tab Bar
          SliverToBoxAdapter(
            child: Container(
              color: AppTheme.surfaceColor,
              child: TabBar(
                controller: _tabController,
                indicatorColor: AppTheme.primaryColor,
                labelColor: AppTheme.primaryColor,
                unselectedLabelColor: AppTheme.textSecondaryColor,
                labelStyle: AppTheme.bodySmall.copyWith(fontWeight: FontWeight.w600),
                tabs: [
                  Tab(text: 'Performance'),
                  Tab(text: localizationService.translate('products')),
                  Tab(text: localizationService.translate('reviews')),
                ],
              ),
            ),
          ),
          // Tab Content
          SliverFillRemaining(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildPerformanceTab(),
                _buildProductsTab(),
                _buildReviewsTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProfileHeader() {
    return Container(
      padding: const EdgeInsets.all(AppTheme.spacing16),
      child: Row(
        children: [
          // Profile Picture
          Stack(
            children: [
              CircleAvatar(
                radius: 50,
                backgroundColor: AppTheme.primaryColor,
                child: Text(
                  widget.user.name.substring(0, 1).toUpperCase(),
                  style: AppTheme.titleLarge.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              if (widget.user.isVerified)
                Positioned(
                  bottom: 0,
                  right: 0,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: Colors.green,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppTheme.surfaceColor, width: 2),
                    ),
                    child: const Icon(
                      Icons.verified,
                      size: 16,
                      color: Colors.white,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: AppTheme.spacing16),
          // Profile Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.user.name,
                  style: AppTheme.titleLarge.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimaryColor,
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text(
                      _getLocationName(widget.user.location),
                      style: AppTheme.bodyMedium.copyWith(
                        color: AppTheme.textSecondaryColor,
                      ),
                    ),
                    if (_distanceFromUser != null) ...[
                      Text(
                        ' (in $_distanceFromUser)',
                        style: AppTheme.bodyMedium.copyWith(
                          color: AppTheme.textSecondaryColor,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ] else if (_isLoadingDistance) ...[
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 12,
                        height: 12,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            AppTheme.textSecondaryColor,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 8),
                // Rating
                Row(
                  children: [
                    Icon(
                      Icons.star,
                      size: 16,
                      color: Colors.amber,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      widget.user.rating.toString(),
                      style: AppTheme.bodyMedium.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textPrimaryColor,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '(${widget.user.totalReviews} reviews)',
                      style: AppTheme.bodySmall.copyWith(
                        color: AppTheme.textSecondaryColor,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsAndActions() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacing16),
      child: Column(
        children: [
          // Stats Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildStatItem('Products', widget.user.totalProducts.toString()),
              _buildStatItem('Followers', _followerCount.toString()),
              _buildStatItem('Following', '${_followerCount ~/ 2}'),
            ],
          ),
          const SizedBox(height: AppTheme.spacing16),
          // Action Buttons
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    setState(() {
                      _isFollowing = !_isFollowing;
                      if (_isFollowing) {
                        _followerCount++;
                      } else {
                        _followerCount--;
                      }
                    });
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _isFollowing ? AppTheme.surfaceColor : AppTheme.primaryColor,
                    foregroundColor: _isFollowing ? AppTheme.textPrimaryColor : Colors.white,
                    side: BorderSide(
                      color: _isFollowing ? AppTheme.thinBorderColor : AppTheme.primaryColor,
                      width: AppTheme.thinBorderWidth,
                    ),
                    padding: const EdgeInsets.symmetric(vertical: AppTheme.spacing8),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppTheme.borderRadius8),
                    ),
                  ),
                  child: Text(
                    _isFollowing ? 'Following' : 'Follow',
                    style: AppTheme.bodySmall.copyWith(
                      fontWeight: FontWeight.w600,
                      color: _isFollowing ? AppTheme.textPrimaryColor : Colors.white,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppTheme.spacing8),
              Expanded(
                child: OutlinedButton(
                  onPressed: () {
                    _openChatWithUser();
                  },
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(
                      color: AppTheme.thinBorderColor,
                      width: AppTheme.thinBorderWidth,
                    ),
                    padding: const EdgeInsets.symmetric(vertical: AppTheme.spacing8),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppTheme.borderRadius8),
                    ),
                  ),
                  child: Text(
                    'Message',
                    style: AppTheme.bodySmall.copyWith(
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textPrimaryColor,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppTheme.spacing8),
              Expanded(
                child: OutlinedButton(
                  onPressed: () {
                    _makeCallToUser();
                  },
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(
                      color: AppTheme.thinBorderColor,
                      width: AppTheme.thinBorderWidth,
                    ),
                    padding: const EdgeInsets.symmetric(vertical: AppTheme.spacing8),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppTheme.borderRadius8),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.phone,
                        size: 16,
                        color: AppTheme.textPrimaryColor,
                      ),
                      const SizedBox(width: AppTheme.spacing4),
                      Text(
                        'Call',
                        style: AppTheme.bodySmall.copyWith(
                          fontWeight: FontWeight.w600,
                          color: AppTheme.textPrimaryColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, String value) {
    return Column(
      children: [
        Text(
          value,
          style: AppTheme.titleMedium.copyWith(
            fontWeight: FontWeight.w700,
            color: AppTheme.textPrimaryColor,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: AppTheme.bodySmall.copyWith(
            color: AppTheme.textSecondaryColor,
          ),
        ),
      ],
    );
  }

  Widget _buildBioSection() {
    return Container(
      padding: const EdgeInsets.all(AppTheme.spacing16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'About ${widget.user.name}',
            style: AppTheme.titleSmall.copyWith(
              fontWeight: FontWeight.w600,
              color: AppTheme.textPrimaryColor,
            ),
          ),
          const SizedBox(height: AppTheme.spacing8),
          Text(
            'Premium dairy products from ${widget.user.location}. '
            'We specialize in fresh, high-quality dairy products '
            'delivered directly from our farm to your doorstep.',
            style: AppTheme.bodySmall.copyWith(
              color: AppTheme.textPrimaryColor,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPerformanceTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppTheme.spacing16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Performance Overview Cards
          // _buildPerformanceOverview(),
          // const SizedBox(height: AppTheme.spacing24),
          
          // Monthly Performance
          _buildMonthlyPerformance(),
          const SizedBox(height: AppTheme.spacing24),
          
          // Performance Charts
          _buildPerformanceCharts(),
        ],
      ),
    );
  }

  Widget _buildPerformanceOverview() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Performance Overview',
          style: AppTheme.titleMedium.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: AppTheme.spacing16),
        Row(
          children: [
            Expanded(
              child: _buildPerformanceCard(
                title: 'Total Sales',
                value: '${widget.user.totalSales}',
                subtitle: 'Liters sold',
                icon: Icons.shopping_cart,
                color: Colors.green,
              ),
            ),
            const SizedBox(width: AppTheme.spacing12),
            Expanded(
              child: _buildPerformanceCard(
                title: 'Collections',
                value: '${widget.user.totalProducts}',
                subtitle: 'Milk collected',
                icon: Icons.local_drink,
                color: Colors.blue,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppTheme.spacing12),
        Row(
          children: [
            Expanded(
              child: _buildPerformanceCard(
                title: 'Onboarding',
                value: '${widget.user.totalReviews}',
                subtitle: 'New farmers',
                icon: Icons.people,
                color: Colors.orange,
              ),
            ),
            const SizedBox(width: AppTheme.spacing12),
            Expanded(
              child: _buildPerformanceCard(
                title: 'Rating',
                value: '${widget.user.rating}',
                subtitle: 'Average rating',
                icon: Icons.star,
                color: Colors.amber,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildPerformanceCard({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppTheme.spacing16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
        border: Border.all(
          color: AppTheme.borderColor,
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(AppTheme.spacing8),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(AppTheme.borderRadius8),
                ),
                child: Icon(
                  icon,
                  color: color,
                  size: 20,
                ),
              ),
              const Spacer(),
            ],
          ),
          const SizedBox(height: AppTheme.spacing12),
          Text(
            value,
            style: AppTheme.titleLarge.copyWith(
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          const SizedBox(height: AppTheme.spacing4),
          Text(
            title,
            style: AppTheme.bodyMedium.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          Text(
            subtitle,
            style: AppTheme.bodySmall.copyWith(
              color: AppTheme.textSecondaryColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPerformanceCharts() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Performance Trends',
          style: AppTheme.titleMedium.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: AppTheme.spacing16),
        Container(
          padding: const EdgeInsets.all(AppTheme.spacing16),
          decoration: BoxDecoration(
            color: AppTheme.surfaceColor,
            borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
            border: Border.all(
              color: AppTheme.borderColor,
              width: 1,
            ),
          ),
          child: Column(
            children: [
              _buildChartItem(
                title: 'Selling Performance',
                percentage: 85,
                color: Colors.green,
                description: 'Above average sales performance',
              ),
              const SizedBox(height: AppTheme.spacing16),
              _buildChartItem(
                title: 'Collection Efficiency',
                percentage: 92,
                color: Colors.blue,
                description: 'Excellent milk collection rate',
              ),
              const SizedBox(height: AppTheme.spacing16),
              _buildChartItem(
                title: 'Onboarding Success',
                percentage: 78,
                color: Colors.orange,
                description: 'Good farmer recruitment rate',
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildChartItem({
    required String title,
    required int percentage,
    required Color color,
    required String description,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              title,
              style: AppTheme.bodyMedium.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              '$percentage%',
              style: AppTheme.bodyMedium.copyWith(
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppTheme.spacing8),
        Container(
          height: 8,
          decoration: BoxDecoration(
            color: AppTheme.borderColor,
            borderRadius: BorderRadius.circular(4),
          ),
          child: FractionallySizedBox(
            alignment: Alignment.centerLeft,
            widthFactor: percentage / 100,
            child: Container(
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
        ),
        const SizedBox(height: AppTheme.spacing4),
        Text(
          description,
          style: AppTheme.bodySmall.copyWith(
            color: AppTheme.textSecondaryColor,
          ),
        ),
      ],
    );
  }

  Widget _buildMonthlyPerformance() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: AppTheme.spacing16),
        Container(
          padding: const EdgeInsets.all(AppTheme.spacing16),
          decoration: BoxDecoration(
            color: AppTheme.surfaceColor,
            borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
            border: Border.all(
              color: AppTheme.borderColor,
              width: 1,
            ),
          ),
          child: Column(
            children: [
              _buildLineChart(),
              const SizedBox(height: AppTheme.spacing16),
              _buildChartLegend(),
              const SizedBox(height: AppTheme.spacing16),
              _buildPeriodSelector(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPeriodSelector() {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppTheme.primaryColor.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: ['Day', 'Week', 'Month'].map((period) {
          final isSelected = _chartPeriod == period;
          return Expanded(
            child: GestureDetector(
              onTap: () {
                setState(() {
                  _chartPeriod = period;
                });
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected ? AppTheme.primaryColor : Colors.transparent,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  period,
                  textAlign: TextAlign.center,
                  style: AppTheme.bodySmall.copyWith(
                    color: isSelected ? Colors.white : AppTheme.primaryColor,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildLineChart() {
    final now = DateTime.now();
    List<String> labels;
    List<int> salesData;
    List<int> collectionsData;
    List<int> onboardingData;
    double maxValue;

    switch (_chartPeriod) {
      case 'Day':
        // Show hours of the day (6 AM to 10 PM) with AM/PM format, every 2 hours
        labels = ['6AM', '8AM', '10AM', '12PM', '2PM', '4PM', '6PM', '8PM', '10PM'];
        salesData = [8, 12, 15, 18, 14, 16, 20, 12, 6];
        collectionsData = [5, 8, 10, 12, 9, 11, 13, 8, 4];
        onboardingData = [2, 3, 4, 5, 3, 4, 5, 3, 1];
        maxValue = 25.0;
        break;
      case 'Week':
        // Show days of the week
        labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        salesData = [12, 15, 8, 18, 14, 22, 16];
        collectionsData = [8, 10, 6, 12, 9, 15, 11];
        onboardingData = [3, 4, 2, 5, 3, 6, 4];
        maxValue = 25.0;
        break;
      case 'Month':
      default:
        // Show every 3rd day of the month
        final daysInMonth = DateTime(now.year, now.month + 1, 0).day;
        final selectedDays = <int>[];
        final dayLabels = <String>[];
        
        for (int i = 1; i <= daysInMonth; i += 3) {
          selectedDays.add(i);
          dayLabels.add('$i');
        }
        
        labels = dayLabels;
        salesData = selectedDays.map((day) => ((day * 2 + 5) % 20 + 1).toInt()).toList();
        collectionsData = selectedDays.map((day) => ((day * 1.5 + 3) % 15 + 1).toInt()).toList();
        onboardingData = selectedDays.map((day) => ((day * 0.8 + 2) % 10 + 1).toInt()).toList();
        maxValue = 25.0;
        break;
    }
    
    final chartHeight = 120.0;
    final chartWidth = 280.0;
    
    return Container(
      height: chartHeight,
      width: chartWidth,
      child: CustomPaint(
        painter: LineChartPainter(
          salesData: salesData,
          collectionsData: collectionsData,
          onboardingData: onboardingData,
          maxValue: maxValue,
          months: labels,
        ),
      ),
    );
  }

  Widget _buildChartLegend() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        _buildLegendItem('Sales', Colors.green),
        _buildLegendItem('Collections', Colors.blue),
        _buildLegendItem('Onboarding', Colors.orange),
      ],
    );
  }

  Widget _buildLegendItem(String label, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: AppTheme.spacing4),
        Text(
          label,
          style: AppTheme.bodySmall.copyWith(
            color: AppTheme.textSecondaryColor,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildProductsTab() {
    // Create static products for this user
    final userProducts = _getStaticProductsForUser();
    
    if (userProducts.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.inventory_2_outlined,
              size: 64,
              color: AppTheme.textSecondaryColor,
            ),
            const SizedBox(height: AppTheme.spacing16),
            Text(
              'No products available',
              style: AppTheme.titleMedium.copyWith(
                color: AppTheme.textSecondaryColor,
              ),
            ),
            const SizedBox(height: AppTheme.spacing8),
            Text(
              'This user hasn\'t added any products yet',
              style: AppTheme.bodyMedium.copyWith(
                color: AppTheme.textSecondaryColor,
              ),
            ),
          ],
        ),
      );
    }

    return GridView.builder(
      padding: const EdgeInsets.all(AppTheme.spacing16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: AppTheme.spacing12,
        mainAxisSpacing: AppTheme.spacing12,
        childAspectRatio: 0.8,
      ),
      itemCount: userProducts.length,
      itemBuilder: (context, index) {
        return _buildProductCard(userProducts[index]);
      },
    );
  }

  List<Product> _getStaticProductsForUser() {
    // Create static products based on the user
    final userId = widget.user.id;
    final userName = widget.user.name;
    final now = DateTime.now();
    
    // Different products for different users
    switch (userId) {
      case 1: // Kigali Dairy Farm
        return [
          Product(
            id: 1001,
            code: 'KDF-MILK-001',
            name: 'Fresh Cow Milk',
            description: 'Fresh, pure cow milk delivered daily from our farm',
            price: 1200.0,
            currency: 'RWF',
            imageUrl: null,
            isAvailable: true,
            stockQuantity: 50,
            createdAt: now.subtract(const Duration(days: 5)),
            updatedAt: now.subtract(const Duration(days: 1)),
            sellerId: userId,
            seller: Seller(
              id: userId,
              code: widget.user.code,
              name: userName,
              phone: widget.user.phone,
              email: widget.user.email,
            ),
            categories: ['Dairy', 'Milk'],
            categoryIds: [1, 2],
          ),
          Product(
            id: 1002,
            code: 'KDF-YOG-001',
            name: 'Natural Yogurt',
            description: 'Creamy natural yogurt made from fresh milk',
            price: 800.0,
            currency: 'RWF',
            imageUrl: null,
            isAvailable: true,
            stockQuantity: 30,
            createdAt: now.subtract(const Duration(days: 3)),
            updatedAt: now.subtract(const Duration(days: 1)),
            sellerId: userId,
            seller: Seller(
              id: userId,
              code: widget.user.code,
              name: userName,
              phone: widget.user.phone,
              email: widget.user.email,
            ),
            categories: ['Dairy', 'Yogurt'],
            categoryIds: [1, 3],
          ),
          Product(
            id: 1003,
            code: 'KDF-CHZ-001',
            name: 'Farm Cheese',
            description: 'Traditional farm-made cheese, aged to perfection',
            price: 2500.0,
            currency: 'RWF',
            imageUrl: null,
            isAvailable: true,
            stockQuantity: 15,
            createdAt: now.subtract(const Duration(days: 1)),
            updatedAt: now.subtract(const Duration(hours: 6)),
            sellerId: userId,
            seller: Seller(
              id: userId,
              code: widget.user.code,
              name: userName,
              phone: widget.user.phone,
              email: widget.user.email,
            ),
            categories: ['Dairy', 'Cheese'],
            categoryIds: [1, 4],
          ),
        ];
      case 2: // Butare Dairy Cooperative
        return [
          Product(
            id: 2001,
            code: 'BDC-MILK-001',
            name: 'Premium Milk',
            description: 'High-quality milk from cooperative farms',
            price: 1100.0,
            currency: 'RWF',
            imageUrl: null,
            isAvailable: true,
            stockQuantity: 40,
            createdAt: now.subtract(const Duration(days: 4)),
            updatedAt: now.subtract(const Duration(days: 1)),
            sellerId: userId,
            seller: Seller(
              id: userId,
              code: widget.user.code,
              name: userName,
              phone: widget.user.phone,
              email: widget.user.email,
            ),
            categories: ['Dairy', 'Milk'],
            categoryIds: [1, 2],
          ),
          Product(
            id: 2002,
            code: 'BDC-YOG-001',
            name: 'Strawberry Yogurt',
            description: 'Delicious strawberry-flavored yogurt',
            price: 900.0,
            currency: 'RWF',
            imageUrl: null,
            isAvailable: true,
            stockQuantity: 25,
            createdAt: now.subtract(const Duration(days: 2)),
            updatedAt: now.subtract(const Duration(hours: 12)),
            sellerId: userId,
            seller: Seller(
              id: userId,
              code: widget.user.code,
              name: userName,
              phone: widget.user.phone,
              email: widget.user.email,
            ),
            categories: ['Dairy', 'Yogurt'],
            categoryIds: [1, 3],
          ),
        ];
      case 3: // Gisenyi Fresh Dairy
        return [
          Product(
            id: 3001,
            code: 'GFD-MILK-001',
            name: 'Organic Milk',
            description: '100% organic milk from grass-fed cows',
            price: 1500.0,
            currency: 'RWF',
            imageUrl: null,
            isAvailable: true,
            stockQuantity: 35,
            createdAt: now.subtract(const Duration(days: 6)),
            updatedAt: now.subtract(const Duration(days: 1)),
            sellerId: userId,
            seller: Seller(
              id: userId,
              code: widget.user.code,
              name: userName,
              phone: widget.user.phone,
              email: widget.user.email,
            ),
            categories: ['Dairy', 'Milk', 'Organic'],
            categoryIds: [1, 2, 5],
          ),
          Product(
            id: 3002,
            code: 'GFD-YOG-001',
            name: 'Vanilla Yogurt',
            description: 'Smooth vanilla yogurt with natural flavoring',
            price: 850.0,
            currency: 'RWF',
            imageUrl: null,
            isAvailable: true,
            stockQuantity: 20,
            createdAt: now.subtract(const Duration(days: 1)),
            updatedAt: now.subtract(const Duration(hours: 8)),
            sellerId: userId,
            seller: Seller(
              id: userId,
              code: widget.user.code,
              name: userName,
              phone: widget.user.phone,
              email: widget.user.email,
            ),
            categories: ['Dairy', 'Yogurt'],
            categoryIds: [1, 3],
          ),
          Product(
            id: 3003,
            code: 'GFD-BTR-001',
            name: 'Butter',
            description: 'Fresh farm butter, perfect for cooking',
            price: 1800.0,
            currency: 'RWF',
            imageUrl: null,
            isAvailable: true,
            stockQuantity: 12,
            createdAt: now.subtract(const Duration(days: 3)),
            updatedAt: now.subtract(const Duration(hours: 4)),
            sellerId: userId,
            seller: Seller(
              id: userId,
              code: widget.user.code,
              name: userName,
              phone: widget.user.phone,
              email: widget.user.email,
            ),
            categories: ['Dairy', 'Butter'],
            categoryIds: [1, 6],
          ),
        ];
      case 4: // Musanze Dairy Center
        return [
          Product(
            id: 4001,
            code: 'MDC-MILK-001',
            name: 'Whole Milk',
            description: 'Rich whole milk with natural cream',
            price: 1300.0,
            currency: 'RWF',
            imageUrl: null,
            isAvailable: true,
            stockQuantity: 45,
            createdAt: now.subtract(const Duration(days: 2)),
            updatedAt: now.subtract(const Duration(hours: 6)),
            sellerId: userId,
            seller: Seller(
              id: userId,
              code: widget.user.code,
              name: userName,
              phone: widget.user.phone,
              email: widget.user.email,
            ),
            categories: ['Dairy', 'Milk'],
            categoryIds: [1, 2],
          ),
          Product(
            id: 4002,
            code: 'MDC-YOG-001',
            name: 'Mango Yogurt',
            description: 'Tropical mango yogurt, refreshing and sweet',
            price: 950.0,
            currency: 'RWF',
            imageUrl: null,
            isAvailable: true,
            stockQuantity: 18,
            createdAt: now.subtract(const Duration(days: 1)),
            updatedAt: now.subtract(const Duration(hours: 2)),
            sellerId: userId,
            seller: Seller(
              id: userId,
              code: widget.user.code,
              name: userName,
              phone: widget.user.phone,
              email: widget.user.email,
            ),
            categories: ['Dairy', 'Yogurt'],
            categoryIds: [1, 3],
          ),
        ];
      case 5: // Nyagatare Farm Fresh
        return [
          Product(
            id: 5001,
            code: 'NFF-MILK-001',
            name: 'Fresh Milk',
            description: 'Daily fresh milk from our local farm',
            price: 1000.0,
            currency: 'RWF',
            imageUrl: null,
            isAvailable: true,
            stockQuantity: 60,
            createdAt: now.subtract(const Duration(days: 3)),
            updatedAt: now.subtract(const Duration(hours: 3)),
            sellerId: userId,
            seller: Seller(
              id: userId,
              code: widget.user.code,
              name: userName,
              phone: widget.user.phone,
              email: widget.user.email,
            ),
            categories: ['Dairy', 'Milk'],
            categoryIds: [1, 2],
          ),
          Product(
            id: 5002,
            code: 'NFF-YOG-001',
            name: 'Plain Yogurt',
            description: 'Simple, natural yogurt without additives',
            price: 750.0,
            currency: 'RWF',
            imageUrl: null,
            isAvailable: true,
            stockQuantity: 35,
            createdAt: now.subtract(const Duration(days: 2)),
            updatedAt: now.subtract(const Duration(hours: 1)),
            sellerId: userId,
            seller: Seller(
              id: userId,
              code: widget.user.code,
              name: userName,
              phone: widget.user.phone,
              email: widget.user.email,
            ),
            categories: ['Dairy', 'Yogurt'],
            categoryIds: [1, 3],
          ),
          Product(
            id: 5003,
            code: 'NFF-CRM-001',
            name: 'Cream',
            description: 'Rich dairy cream for desserts and cooking',
            price: 1600.0,
            currency: 'RWF',
            imageUrl: null,
            isAvailable: true,
            stockQuantity: 8,
            createdAt: now.subtract(const Duration(days: 4)),
            updatedAt: now.subtract(const Duration(hours: 5)),
            sellerId: userId,
            seller: Seller(
              id: userId,
              code: widget.user.code,
              name: userName,
              phone: widget.user.phone,
              email: widget.user.email,
            ),
            categories: ['Dairy', 'Cream'],
            categoryIds: [1, 7],
          ),
        ];
      default:
        return [];
    }
  }

  Widget _buildProductCard(Product product) {
    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (context) => ProductDetailsScreen(product: product),
          ),
        );
      },
      child: Container(
        decoration: BoxDecoration(
          color: AppTheme.surfaceColor,
          borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: AppTheme.primaryColor.withOpacity(0.1),
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(AppTheme.borderRadius12),
                    topRight: Radius.circular(AppTheme.borderRadius12),
                  ),
                ),
                child: product.imageUrl != null
                    ? ClipRRect(
                        borderRadius: const BorderRadius.only(
                          topLeft: Radius.circular(AppTheme.borderRadius12),
                          topRight: Radius.circular(AppTheme.borderRadius12),
                        ),
                        child: Image.network(
                          product.imageUrl!,
                          fit: BoxFit.cover,
                          width: double.infinity,
                        ),
                      )
                    : Center(
                        child: Icon(
                          Icons.inventory_2,
                          size: 40,
                          color: AppTheme.primaryColor,
                        ),
                      ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppTheme.spacing8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    style: AppTheme.bodySmall.copyWith(
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textPrimaryColor,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'RWF ${product.price.toStringAsFixed(0)}',
                    style: AppTheme.bodySmall.copyWith(
                      color: AppTheme.primaryColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReviewsTab() {
    // Mock reviews data
    final reviews = [
      {
        'name': 'John Doe',
        'rating': 5.0,
        'comment': 'Excellent quality products! Very fresh and delivered on time.',
        'date': '2 days ago',
      },
      {
        'name': 'Jane Smith',
        'rating': 4.0,
        'comment': 'Good service, but delivery was a bit late.',
        'date': '1 week ago',
      },
      {
        'name': 'Mike Johnson',
        'rating': 5.0,
        'comment': 'Amazing dairy products! Will definitely order again.',
        'date': '2 weeks ago',
      },
    ];

    return ListView.builder(
      padding: const EdgeInsets.all(AppTheme.spacing16),
      itemCount: reviews.length,
      itemBuilder: (context, index) {
        final review = reviews[index];
        return Container(
          margin: const EdgeInsets.only(bottom: AppTheme.spacing16),
          padding: const EdgeInsets.all(AppTheme.spacing16),
          decoration: BoxDecoration(
            color: AppTheme.surfaceColor,
            borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                blurRadius: 10,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: AppTheme.primaryColor,
                    child: Text(
                      (review['name'] as String).substring(0, 1).toUpperCase(),
                      style: AppTheme.bodyMedium.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const SizedBox(width: AppTheme.spacing12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          review['name'] as String,
                          style: AppTheme.bodyMedium.copyWith(
                            fontWeight: FontWeight.w600,
                            color: AppTheme.textPrimaryColor,
                          ),
                        ),
                        Row(
                          children: [
                            ...List.generate(5, (i) {
                              return Icon(
                                i < (review['rating'] as double).toInt()
                                    ? Icons.star
                                    : Icons.star_border,
                                size: 16,
                                color: Colors.amber,
                              );
                            }),
                            const SizedBox(width: 8),
                            Text(
                              review['date'] as String,
                              style: AppTheme.bodySmall.copyWith(
                                color: AppTheme.textSecondaryColor,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppTheme.spacing12),
              Text(
                review['comment'] as String,
                style: AppTheme.bodyMedium.copyWith(
                  color: AppTheme.textPrimaryColor,
                  height: 1.4,
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildAboutTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppTheme.spacing16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildInfoCard(
            'Contact Information',
            [
              _buildInfoRow('Phone', widget.user.phone ?? 'Not provided'),
              _buildInfoRow('Email', widget.user.email ?? 'Not provided'),
              _buildLocationRow(),
            ],
          ),
          const SizedBox(height: AppTheme.spacing16),
          _buildInfoCard(
            'Business Information',
            [
              _buildInfoRow('User Code', widget.user.code),
              _buildInfoRow('Join Date', widget.user.joinDate),
              _buildInfoRow('Verification', widget.user.isVerified ? 'Verified' : 'Not Verified'),
            ],
          ),
          const SizedBox(height: AppTheme.spacing16),
          _buildInfoCard(
            'Performance',
            [
              _buildInfoRow('Rating', '${widget.user.rating}/5.0'),
              _buildInfoRow('Total Products', widget.user.totalProducts.toString()),
              _buildInfoRow('Total Sales', widget.user.totalSales.toString()),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard(String title, List<Widget> children) {
    return Container(
      padding: const EdgeInsets.all(AppTheme.spacing16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.circular(AppTheme.borderRadius12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: AppTheme.titleSmall.copyWith(
              fontWeight: FontWeight.w600,
              color: AppTheme.textPrimaryColor,
            ),
          ),
          const SizedBox(height: AppTheme.spacing12),
          ...children,
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppTheme.spacing8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: AppTheme.bodySmall.copyWith(
                color: AppTheme.textSecondaryColor,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: AppTheme.bodySmall.copyWith(
                color: AppTheme.textPrimaryColor,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLocationRow() {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppTheme.spacing8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              'Location',
              style: AppTheme.bodySmall.copyWith(
                color: AppTheme.textSecondaryColor,
              ),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.user.location,
                  style: AppTheme.bodySmall.copyWith(
                    color: AppTheme.textPrimaryColor,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                if (_isLoadingDistance)
                  const SizedBox(
                    width: 12,
                    height: 12,
                    child: CircularProgressIndicator(
                      strokeWidth: 1.5,
                      valueColor: AlwaysStoppedAnimation<Color>(AppTheme.primaryColor),
                    ),
                  )
                else if (_distanceFromUser != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Row(
                      children: [
                        Icon(
                          Icons.location_on,
                          size: 12,
                          color: _distanceFromUser!.contains('unknown') || 
                                 _distanceFromUser!.contains('unavailable')
                              ? AppTheme.textSecondaryColor
                              : AppTheme.primaryColor,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          _distanceFromUser!.contains('unknown') || 
                          _distanceFromUser!.contains('unavailable')
                              ? _distanceFromUser!
                              : '$_distanceFromUser away',
                          style: AppTheme.bodySmall.copyWith(
                            color: _distanceFromUser!.contains('unknown') || 
                                   _distanceFromUser!.contains('unavailable')
                                ? AppTheme.textSecondaryColor
                                : AppTheme.primaryColor,
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showMoreOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surfaceColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.borderRadius16)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(AppTheme.spacing16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.report),
              title: Text(
                'Report User',
                style: AppTheme.bodyMedium.copyWith(
                  color: AppTheme.errorColor,
                ),
              ),
              onTap: () {
                Navigator.pop(context);
                // TODO: Implement report functionality
              },
            ),
            ListTile(
              leading: const Icon(Icons.share),
              title: Text(
                'Share Profile',
                style: AppTheme.bodyMedium.copyWith(
                  color: AppTheme.textPrimaryColor,
                ),
              ),
              onTap: () {
                Navigator.pop(context);
                // TODO: Implement share functionality
              },
            ),
            ListTile(
              leading: const Icon(Icons.block),
              title: Text(
                'Block User',
                style: AppTheme.bodyMedium.copyWith(
                  color: AppTheme.errorColor,
                ),
              ),
              onTap: () {
                Navigator.pop(context);
                // TODO: Implement block functionality
              },
            ),
          ],
        ),
      ),
    );
  }
}

class LineChartPainter extends CustomPainter {
  final List<int> salesData;
  final List<int> collectionsData;
  final List<int> onboardingData;
  final double maxValue;
  final List<String> months;

  LineChartPainter({
    required this.salesData,
    required this.collectionsData,
    required this.onboardingData,
    required this.maxValue,
    required this.months,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // Create smooth paint with better styling
    final salesPaint = Paint()
      ..color = const Color(0xFF10B981) // Modern green
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final collectionsPaint = Paint()
      ..color = const Color(0xFF3B82F6) // Modern blue
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final onboardingPaint = Paint()
      ..color = const Color(0xFFF59E0B) // Modern orange
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    // Gradient fills for area under curves
    final salesGradient = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          const Color(0xFF10B981).withOpacity(0.3),
          const Color(0xFF10B981).withOpacity(0.05),
        ],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));

    final collectionsGradient = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          const Color(0xFF3B82F6).withOpacity(0.3),
          const Color(0xFF3B82F6).withOpacity(0.05),
        ],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));

    final onboardingGradient = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          const Color(0xFFF59E0B).withOpacity(0.3),
          const Color(0xFFF59E0B).withOpacity(0.05),
        ],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));

    // Draw subtle grid lines
    final gridPaint = Paint()
      ..color = AppTheme.borderColor.withOpacity(0.2)
      ..strokeWidth = 0.5;

    // Horizontal grid lines
    for (int i = 0; i <= 4; i++) {
      final y = size.height * 0.1 + (size.height * 0.8 * i / 4);
      canvas.drawLine(
        Offset(0, y),
        Offset(size.width, y),
        gridPaint,
      );
    }

    // Draw smooth curved lines with gradients
    _drawSmoothLine(canvas, size, salesData, salesPaint, salesGradient, const Color(0xFF10B981));
    _drawSmoothLine(canvas, size, collectionsData, collectionsPaint, collectionsGradient, const Color(0xFF3B82F6));
    _drawSmoothLine(canvas, size, onboardingData, onboardingPaint, onboardingGradient, const Color(0xFFF59E0B));

    // Draw month labels with better styling
    final textPainter = TextPainter(
      textDirection: TextDirection.ltr,
    );

    for (int i = 0; i < months.length; i++) {
      textPainter.text = TextSpan(
        text: months[i],
        style: AppTheme.bodySmall.copyWith(
          color: AppTheme.textSecondaryColor,
          fontSize: 11,
          fontWeight: FontWeight.w500,
        ),
      );
      textPainter.layout();
      textPainter.paint(
        canvas,
        Offset(
          (size.width / (months.length - 1)) * i - textPainter.width / 2,
          size.height - 12,
        ),
      );
    }
  }

  void _drawSmoothLine(Canvas canvas, Size size, List<int> data, Paint linePaint, Paint gradientPaint, Color pointColor) {
    if (data.isEmpty) return;

    final points = <Offset>[];
    final pointRadius = 1.5;

    // Calculate all points
    for (int i = 0; i < data.length; i++) {
      final x = (size.width / (data.length - 1)) * i;
      final y = size.height * 0.9 - (data[i] / maxValue) * size.height * 0.8;
      points.add(Offset(x, y));
    }

    // Create smooth curved path using cubic bezier curves
    final path = Path();
    final gradientPath = Path();

    if (points.isNotEmpty) {
      path.moveTo(points[0].dx, points[0].dy);
      gradientPath.moveTo(points[0].dx, size.height * 0.9);
      gradientPath.lineTo(points[0].dx, points[0].dy);

      for (int i = 0; i < points.length - 1; i++) {
        final currentPoint = points[i];
        final nextPoint = points[i + 1];
        
        // Calculate control points for smooth curves
        final controlPoint1 = Offset(
          currentPoint.dx + (nextPoint.dx - currentPoint.dx) / 3,
          currentPoint.dy,
        );
        final controlPoint2 = Offset(
          nextPoint.dx - (nextPoint.dx - currentPoint.dx) / 3,
          nextPoint.dy,
        );

        path.cubicTo(
          controlPoint1.dx, controlPoint1.dy,
          controlPoint2.dx, controlPoint2.dy,
          nextPoint.dx, nextPoint.dy,
        );

        gradientPath.cubicTo(
          controlPoint1.dx, controlPoint1.dy,
          controlPoint2.dx, controlPoint2.dy,
          nextPoint.dx, nextPoint.dy,
        );
      }

      // Complete the gradient path
      gradientPath.lineTo(points.last.dx, size.height * 0.9);
      gradientPath.close();
    }

    // Draw gradient fill first
    canvas.drawPath(gradientPath, gradientPaint);
    
    // Draw the smooth line
    canvas.drawPath(path, linePaint);

    // Draw data points with better styling
    final pointPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;

    final pointBorderPaint = Paint()
      ..color = pointColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;

    for (final point in points) {
      canvas.drawCircle(point, pointRadius, pointPaint);
      canvas.drawCircle(point, pointRadius, pointBorderPaint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
