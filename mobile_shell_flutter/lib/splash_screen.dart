import 'package:flutter/material.dart';

class SplashScreen extends StatefulWidget {
  final VoidCallback onSplashEnd;

  const SplashScreen({super.key, required this.onSplashEnd});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;
  late Animation<double> _glowAnimation;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      duration: const Duration(milliseconds: 2000),
      vsync: this,
    );

    _fadeAnimation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0, 0.45)),
    );

    _scaleAnimation = Tween<double>(
      begin: 0.86,
      end: 1,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));

    _glowAnimation = Tween<double>(
      begin: 0.22,
      end: 0.38,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));

    _controller.forward();

    Future.delayed(const Duration(milliseconds: 2500), () {
      if (mounted) {
        widget.onSplashEnd();
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final logoWidth = (MediaQuery.sizeOf(context).width * 0.64)
        .clamp(200.0, 340.0)
        .toDouble();

    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(color: Colors.white),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Positioned(
              top: -90,
              left: -70,
              child: Container(
                width: 220,
                height: 220,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFF1F3F6).withValues(alpha: 0.9),
                ),
              ),
            ),
            Positioned(
              bottom: -110,
              right: -90,
              child: Container(
                width: 260,
                height: 260,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFE5E9EF).withValues(alpha: 0.85),
                ),
              ),
            ),
            SafeArea(
              top: true,
              bottom: false,
              child: Center(
                child: FadeTransition(
                  opacity: _fadeAnimation,
                  child: ScaleTransition(
                    scale: _scaleAnimation,
                    child: AnimatedBuilder(
                      animation: _glowAnimation,
                      builder: (context, child) {
                        return DecoratedBox(
                          decoration: BoxDecoration(
                            boxShadow: [
                              BoxShadow(
                                color: const Color(
                                  0xFF9FDBFF,
                                ).withValues(alpha: _glowAnimation.value),
                                blurRadius: logoWidth * 0.28,
                                spreadRadius: logoWidth * 0.05,
                              ),
                            ],
                          ),
                          child: child,
                        );
                      },
                      child: SizedBox(
                        width: logoWidth,
                        child: Image.asset(
                          'assets/icons/loading-logo.png',
                          fit: BoxFit.contain,
                          filterQuality: FilterQuality.high,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
