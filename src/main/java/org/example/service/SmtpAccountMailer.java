package org.example.service;

import org.springframework.core.env.Environment;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.util.Arrays;
import java.util.Properties;

@Component
public class SmtpAccountMailer implements AccountMailer {
    private final Environment env;
    public SmtpAccountMailer(Environment env) { this.env = env; }
    @Override public boolean isConfigured() {
        String host = env.getProperty("recce.account.smtp.host", "");
        String from = env.getProperty("recce.account.mail-from", "");
        boolean encrypted = env.getProperty("recce.account.smtp.ssl", Boolean.class, false) || env.getProperty("recce.account.smtp.starttls", Boolean.class, true);
        if (!encrypted && !Arrays.asList("localhost", "127.0.0.1", "::1").contains(host)) return false;
        try {
            URI base = URI.create(env.getProperty("recce.account.public-base-url", ""));
            boolean secure = "https".equals(base.getScheme()) || ("http".equals(base.getScheme()) && Arrays.asList("localhost", "127.0.0.1", "[::1]", "::1").contains(base.getHost()));
            return !host.trim().isEmpty() && from.matches("[^\\s@]+@[^\\s@]+") && secure && base.getHost() != null && base.getUserInfo() == null && base.getQuery() == null && base.getFragment() == null;
        } catch (IllegalArgumentException ex) { return false; }
    }
    @Override public void send(String email, String purpose, String token) {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(env.getProperty("recce.account.smtp.host"));
        sender.setPort(env.getProperty("recce.account.smtp.port", Integer.class, 587));
        sender.setUsername(env.getProperty("recce.account.smtp.username", ""));
        sender.setPassword(env.getProperty("recce.account.smtp.password", ""));
        sender.setDefaultEncoding("UTF-8");
        boolean ssl = env.getProperty("recce.account.smtp.ssl", Boolean.class, false);
        boolean tls = !ssl && env.getProperty("recce.account.smtp.starttls", Boolean.class, true);
        Properties props = sender.getJavaMailProperties();
        props.setProperty("mail.smtp.auth", String.valueOf(!sender.getUsername().isEmpty()));
        props.setProperty("mail.smtp.ssl.enable", String.valueOf(ssl));
        props.setProperty("mail.smtp.starttls.enable", String.valueOf(tls));
        props.setProperty("mail.smtp.starttls.required", String.valueOf(tls));
        props.setProperty("mail.smtp.ssl.checkserveridentity", "true");
        props.setProperty("mail.smtp.connectiontimeout", "5000"); props.setProperty("mail.smtp.timeout", "5000"); props.setProperty("mail.smtp.writetimeout", "5000");
        props.setProperty("mail.debug", "false");
        String base = env.getProperty("recce.account.public-base-url", "").replaceAll("/+$", "");
        String route = "VERIFY".equals(purpose) ? "/verify-email" : "/reset-password";
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(env.getProperty("recce.account.mail-from")); message.setTo(email);
        message.setSubject("VERIFY".equals(purpose) ? "Recce Studio — verificar email" : "Recce Studio — recuperar acesso");
        message.setText("Foi pedido acesso para este endereço. Se foste tu, abre o link e define a tua password. O pedido só será aplicado se a conta estiver elegível. Se já tens conta, usa Recuperar acesso. Se não fizeste o pedido, ignora este email.\n\n" + base + route + "#token=" + token + "\n\nO link tem prazo e só pode ser usado uma vez. Nunca partilhes este link.");
        sender.send(message);
    }
}
