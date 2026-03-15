package com.atharva.offlineupi.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

// ✅ FIX: Add this new file to your project at:
// src/main/java/com/atharva/offlineupi/config/CorsConfig.java
//
// Without this, Spring Boot will BLOCK all requests from your React Native app
// with a CORS error, making the frontend and backend unable to connect.

@Configuration
public class CorsConfig {

    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();

        // Allow requests from any origin (your Expo dev app, emulator, physical device)
        config.setAllowedOriginPatterns(List.of("*"));

        // Allow all standard HTTP methods
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));

        // Allow all headers including Authorization (for JWT)
        config.setAllowedHeaders(List.of("*"));

        // Allow credentials (cookies/auth headers)
        config.setAllowCredentials(false); // Keep false when using wildcard origin

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        return new CorsFilter(source);
    }
}
