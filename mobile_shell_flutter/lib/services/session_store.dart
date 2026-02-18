import 'package:shared_preferences/shared_preferences.dart';

import '../app_config.dart';

class SessionStore {
  Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(AppConfig.prefsLoggedInKey) ?? false;
  }

  Future<String?> username() async {
    final prefs = await SharedPreferences.getInstance();
    final value = prefs.getString(AppConfig.prefsUsernameKey);
    if (value == null || value.trim().isEmpty) return null;
    return value.trim();
  }

  Future<void> saveLogin(String username) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(AppConfig.prefsLoggedInKey, true);
    await prefs.setString(AppConfig.prefsUsernameKey, username.trim());
  }

  Future<void> clearLogin() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(AppConfig.prefsLoggedInKey);
    await prefs.remove(AppConfig.prefsUsernameKey);
  }

  Future<String?> localVersion() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(AppConfig.prefsLocalVersionKey);
  }

  Future<void> setLocalVersion(String version) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(AppConfig.prefsLocalVersionKey, version);
  }
}
