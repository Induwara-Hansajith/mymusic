# My Music — Android

Native Kotlin / Jetpack Compose player with two distribution flavors:

| Flavor | App ID | YouTube streaming | Intended store |
|--------|--------|-------------------|----------------|
| **play** | `com.induw.mymusic` | No (local library only) | Google Play |
| **full** | `com.induw.mymusic.full` | Yes (NewPipe Extractor) | GitHub / F-Droid |

Shared: Media3 playback service, Room library cache, LRCLIB lyrics, Supabase `user_libraries` REST sync hooks.

## Build

```bash
cd android
.\gradlew.bat :app:assemblePlayDebug
.\gradlew.bat :app:assembleFullDebug
```

APKs land in `app/build/outputs/apk/`.

## Notes

- Play and Full can be installed side by side (different application IDs).
- Do not ship the **full** APK to Google Play.
- Set `sdk.dir` in `local.properties` if the SDK path differs.
