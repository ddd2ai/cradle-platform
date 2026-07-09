package com.example.cradlerbacdemo.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public UserDetailsService users(PasswordEncoder passwordEncoder) {
        // 建立三個範例使用者：admin, manager, user
        UserDetails admin = User.withUsername("alice.admin")
                .password(passwordEncoder.encode("adminpass"))
                .roles("ADMIN") // ROLE_ADMIN
                .authorities("USER:CREATE", "USER:DELETE", "ORDER:MANAGE")
                .build();

        UserDetails manager = User.withUsername("bob.manager")
                .password(passwordEncoder.encode("managerpass"))
                .roles("MANAGER")
                .authorities("ORDER:MANAGE", "REPORT:VIEW")
                .build();

        UserDetails user = User.withUsername("carol.user")
                .password(passwordEncoder.encode("userpass"))
                .roles("USER")
                .authorities("PROFILE:VIEW")
                .build();

        return new InMemoryUserDetailsManager(admin, manager, user);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/public/**", "/actuator/health").permitAll()
                .anyRequest().authenticated()
            )
            .httpBasic();

        return http.build();
    }
}