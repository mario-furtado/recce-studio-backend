package org.example.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
public class AuthTokenConfiguration {
    @Bean
    public Clock authTokenClock() {
        return Clock.systemUTC();
    }
}
