package com.workflow.system.config;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
  private final SecretKey key;
  private final long ttlSeconds;

  public JwtService(
      @Value("${app.jwt.secret}") String secret, @Value("${app.jwt.ttlMinutes:240}") long ttlMinutes) {
    // HS256 necesita un secreto suficientemente largo
    String s = secret == null ? "" : secret.trim();
    if (s.length() < 32) {
      s = (s + "................................").substring(0, 32);
    }
    this.key = Keys.hmacShaKeyFor(s.getBytes(StandardCharsets.UTF_8));
    this.ttlSeconds = Math.max(60, ttlMinutes * 60);
  }

  public long getTtlSeconds() {
    return ttlSeconds;
  }

  public String issueToken(String userId, String email, List<String> permissions) {
    Instant now = Instant.now();
    Instant exp = now.plusSeconds(ttlSeconds);
    return Jwts.builder()
        .subject(userId)
        .issuedAt(Date.from(now))
        .expiration(Date.from(exp))
        .claims(Map.of("email", email, "perms", permissions))
        .signWith(key)
        .compact();
  }

  public io.jsonwebtoken.Claims parse(String token) {
    return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
  }
}

