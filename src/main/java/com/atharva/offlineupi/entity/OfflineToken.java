package com.atharva.offlineupi.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "offline_tokens")
public class OfflineToken {

    @Id
    private String tokenId; // The unique Nonce inside the JWT payload

    @Column(nullable = false)
    private String senderId; // The User ID who generated the token

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String jwtPayload; // The actual encrypted string that goes over Bluetooth

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE"; // ACTIVE, SPENT, or EXPIRED

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime expiresAt; // Tokens should expire if not used

    // --- GETTERS AND SETTERS ---
    public String getTokenId() { return tokenId; }
    public void setTokenId(String tokenId) { this.tokenId = tokenId; }

    public String getSenderId() { return senderId; }
    public void setSenderId(String senderId) { this.senderId = senderId; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getJwtPayload() { return jwtPayload; }
    public void setJwtPayload(String jwtPayload) { this.jwtPayload = jwtPayload; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
}