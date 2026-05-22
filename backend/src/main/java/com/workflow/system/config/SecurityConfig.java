package com.workflow.system.config;

import java.util.List;

import org.springframework.http.HttpMethod;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {
  @Bean
  SecurityFilterChain securityFilterChain(
      HttpSecurity http,
      JwtService jwtService,
      @Value("${app.security.enabled:false}") boolean securityEnabled)
      throws Exception {
    http.csrf(AbstractHttpConfigurer::disable);
    http.cors(Customizer.withDefaults());
    http.httpBasic(AbstractHttpConfigurer::disable);
    http.formLogin(AbstractHttpConfigurer::disable);
    http.sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

    if (!securityEnabled) {
      // Dev: todo permitido (para no romper UX actual).
      http.authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
      return http.build();
    }

    http.addFilterBefore(new JwtAuthFilter(jwtService), UsernamePasswordAuthenticationFilter.class);
    http.authorizeHttpRequests(
        auth ->
            auth.requestMatchers("/api/health", "/api/auth/**", "/ws/**")
                .permitAll()
                .requestMatchers(HttpMethod.GET, "/api/tasks", "/api/tasks/my/**")
                .permitAll()
                .requestMatchers(HttpMethod.GET, "/api/users", "/api/roles")
                .permitAll()
                .requestMatchers(HttpMethod.POST, "/api/ai/assistant/**")
                .permitAll()
                // Generación/edición de diagrama y sugerencias (demo/examen; sin API keys el backend usa fallbacks)
                .requestMatchers(
                    HttpMethod.POST,
                    "/api/ai/diagram-edits/**",
                    "/api/ai/workflow-suggestions/**",
                    "/api/ai/diagram/suggest",
                    "/api/ai/form/autofill")
                .permitAll()
                .requestMatchers(HttpMethod.GET, "/api/policies/*/forms")
                .permitAll()
                .requestMatchers(HttpMethod.GET, "/api/reports/workflow-kpis")
                .hasAnyAuthority("REPORTS_VIEW", "ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/ai/process-insights")
                .hasAnyAuthority("REPORTS_VIEW", "ADMIN")
                .anyRequest()
                .authenticated());
    return http.build();
  }

  @Bean
  PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
  }

  @Bean
  CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration cfg = new CorsConfiguration();
    cfg.setAllowedOriginPatterns(List.of("*"));
    cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    cfg.setAllowedHeaders(List.of("*"));
    cfg.setAllowCredentials(false);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", cfg);
    return source;
  }
}

