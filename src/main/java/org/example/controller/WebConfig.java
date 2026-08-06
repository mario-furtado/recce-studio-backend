package org.example.controller;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    private final ApiAuthInterceptor apiAuthInterceptor;

    public WebConfig(ApiAuthInterceptor apiAuthInterceptor) {
        this.apiAuthInterceptor = apiAuthInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(apiAuthInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns(
                        "/api/auth/**",
                        "/api/team-profile/logo",
                        "/api/team-profile/cars/*/photo",
                        "/api/rallies/*/logo",
                        "/api/pecs/*/video"
                );
    }
}
