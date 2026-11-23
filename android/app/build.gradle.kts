plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.devtools.ksp")
}

android {
    namespace = "com.induw.mymusic"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.induw.mymusic"
        minSdk = 26
        targetSdk = 35
        versionCode = 8
        versionName = "1.1.8"

        buildConfigField("String", "SUPABASE_URL", "\"https://sjvnqqacnbnqdljuhpsh.supabase.co\"")
        buildConfigField(
            "String",
            "SUPABASE_ANON_KEY",
            "\"sb_publishable_Xt2LF3sA6V-kn6Rmx9Criw_iCkkkdhK\""
        )
        buildConfigField("String", "LRCLIB_BASE", "\"https://lrclib.net\"")
    }

    flavorDimensions += "distribution"
    productFlavors {
        create("play") {
            dimension = "distribution"
            applicationIdSuffix = ""
            versionNameSuffix = "-play"
            buildConfigField("boolean", "YOUTUBE_STREAMING", "false")
            buildConfigField("String", "FLAVOR_LABEL", "\"Play\"")
            resValue("string", "app_name", "My Music")
        }
        create("full") {
            dimension = "distribution"
            applicationIdSuffix = ".full"
            versionNameSuffix = "-full"
            buildConfigField("boolean", "YOUTUBE_STREAMING", "true")
            buildConfigField("String", "FLAVOR_LABEL", "\"Full\"")
            resValue("string", "app_name", "My Music Full")
        }
    }

    signingConfigs {
        create("release") {
            storeFile = rootProject.file("mymusic-release.jks")
            storePassword = System.getenv("MYMUSIC_STORE_PW") ?: "mymusic-release-2026"
            keyAlias = "mymusic"
            keyPassword = System.getenv("MYMUSIC_KEY_PW") ?: "mymusic-release-2026"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            applicationIdSuffix = ".debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    debugImplementation("androidx.compose.ui:ui-tooling")

    val media3 = "1.5.1"
    implementation("androidx.media3:media3-exoplayer:$media3")
    implementation("androidx.media3:media3-session:$media3")
    implementation("androidx.media3:media3-ui:$media3")
    implementation("androidx.media3:media3-common:$media3")

    val room = "2.6.1"
    implementation("androidx.room:room-runtime:$room")
    implementation("androidx.room:room-ktx:$room")
    ksp("androidx.room:room-compiler:$room")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("io.coil-kt:coil-compose:2.7.0")

    // Full flavor only: NewPipe Extractor for YouTube Music streams (not shipped in Play builds)
    add("fullImplementation", "com.github.TeamNewPipe:NewPipeExtractor:0.24.6")
}
