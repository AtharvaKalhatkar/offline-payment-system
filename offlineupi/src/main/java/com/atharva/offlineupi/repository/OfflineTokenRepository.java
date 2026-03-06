package com.atharva.offlineupi.repository;

import com.atharva.offlineupi.entity.OfflineToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OfflineTokenRepository extends JpaRepository<OfflineToken, String> {
    // We will need this later to make sure a token hasn't already been spent!
    boolean existsByTokenId(String tokenId);
}