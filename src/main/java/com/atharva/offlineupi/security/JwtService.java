package com.atharva.offlineupi.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.util.Date;

@Service
public class JwtService {

    private static final long EXPIRATION_TIME = 1000 * 60 * 60 * 24; // 24 hours

    // 1. SIGNING: Called by the Sender's phone to create the Bluetooth payload
    public String generateOfflineToken(String senderId, BigDecimal amount, String nonce, PrivateKey privateKey) {
        return Jwts.builder()
                .setSubject(senderId)
                .claim("amount", amount.toString()) // Convert BigDecimal to String to avoid precision loss in JSON
                .claim("nonce", nonce)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + EXPIRATION_TIME))
                // This is the magic: It locks the token using the user's hidden private key
                .signWith(privateKey, SignatureAlgorithm.RS256) 
                .compact();
    }

    // 2. VERIFYING: Called by the Server when the Receiver uploads the token via Wi-Fi
    public Claims verifyOfflineToken(String token, PublicKey publicKey) {
        // If a hacker changed even a single decimal in the amount, this method will instantly throw an Exception!
        return Jwts.parserBuilder()
                .setSigningKey(publicKey)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}