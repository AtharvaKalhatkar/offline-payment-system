package com.atharva.offlineupi.security;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

import org.springframework.stereotype.Component;

@Component
public class CryptoUtils {

    // This method generates the mathematically linked Public and Private keys
    public KeyPair generateRSAKeyPair() {
        try {
            // RSA is the industry standard for asymmetric encryption
            KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
            
            // 2048-bit size is highly secure but fast enough for mobile devices
            keyGen.initialize(2048); 
            
            return keyGen.generateKeyPair();
            
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("RSA algorithm not found on this system!", e);
        }
    }

    // Helper method to convert the raw mathematical key into a readable String for the database
    public String encodeKeyToBase64(byte[] keyBytes) {
        return Base64.getEncoder().encodeToString(keyBytes);
    }
}