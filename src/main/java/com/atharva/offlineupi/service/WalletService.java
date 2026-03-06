package com.atharva.offlineupi.service;

import java.math.BigDecimal;
import java.security.KeyPair;
import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.atharva.offlineupi.entity.OfflineToken;
import com.atharva.offlineupi.entity.Transaction;
import com.atharva.offlineupi.entity.User;
import com.atharva.offlineupi.repository.OfflineTokenRepository;
import com.atharva.offlineupi.repository.TransactionRepository;
import com.atharva.offlineupi.repository.UserRepository;
import com.atharva.offlineupi.security.CryptoUtils;
import com.atharva.offlineupi.security.JwtService;

@Service
public class WalletService {

    private final UserRepository userRepository;
    private final OfflineTokenRepository tokenRepository;
    private final TransactionRepository transactionRepository;
    
    // Injecting our new Phase 2 Security classes
    private final JwtService jwtService;
    private final KeyPair serverKeyPair; // The "Bank's" master keys

    public WalletService(UserRepository userRepo, OfflineTokenRepository tokenRepo, 
                         TransactionRepository txRepo, JwtService jwtService, CryptoUtils cryptoUtils) {
        this.userRepository = userRepo;
        this.tokenRepository = tokenRepo;
        this.transactionRepository = txRepo;
        this.jwtService = jwtService;
        
        // For V1, the server generates its own master lock and key when it starts up
        this.serverKeyPair = cryptoUtils.generateRSAKeyPair(); 
    }

    @Transactional
    public String loadOfflineWallet(String userId, BigDecimal amount) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getCloudBalance().compareTo(amount) < 0) {
            throw new RuntimeException("Insufficient cloud balance!");
        }

        // 1. Deduct money from cloud balance (Escrow)
        user.setCloudBalance(user.getCloudBalance().subtract(amount));
        userRepository.save(user);

        // 2. Create the unique Nonce
        String nonce = UUID.randomUUID().toString();

        // 3. PHASE 2 UPGRADE: Generate the real cryptographic JWT
        String secureJwt = jwtService.generateOfflineToken(
                userId, 
                amount, 
                nonce, 
                serverKeyPair.getPrivate() // Signed by the Bank!
        );

        // 4. Save the Token record to the database
        OfflineToken token = new OfflineToken();
        token.setTokenId(nonce);
        token.setSenderId(userId);
        token.setAmount(amount);
        token.setExpiresAt(LocalDateTime.now().plusDays(1));
        token.setJwtPayload(secureJwt); 
        
        tokenRepository.save(token);

        return secureJwt; // Return the secure token to the React Native app
    }

    @Transactional
    public void settleTransaction(String receiverId, String tokenId) {
        // ... (The rest of this method stays exactly the same as yesterday)
        OfflineToken token = tokenRepository.findById(tokenId)
                .orElseThrow(() -> new RuntimeException("Invalid Token!"));

        if (!token.getStatus().equals("ACTIVE")) {
            throw new RuntimeException("Token already spent or expired!");
        }

        User receiver = userRepository.findById(receiverId)
                .orElseThrow(() -> new RuntimeException("Receiver not found"));
        receiver.setCloudBalance(receiver.getCloudBalance().add(token.getAmount()));
        userRepository.save(receiver);

        token.setStatus("SPENT");
        tokenRepository.save(token);

        Transaction tx = new Transaction();
        tx.setSenderId(token.getSenderId());
        tx.setReceiverId(receiverId);
        tx.setTokenId(tokenId);
        tx.setAmount(token.getAmount());
        transactionRepository.save(tx);
    }
}