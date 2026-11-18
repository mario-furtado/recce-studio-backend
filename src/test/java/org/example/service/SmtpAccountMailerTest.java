package org.example.service;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

class SmtpAccountMailerTest {
    MockEnvironment config(int port) {
        return new MockEnvironment().withProperty("recce.account.smtp.host","127.0.0.1").withProperty("recce.account.smtp.port",String.valueOf(port))
            .withProperty("recce.account.smtp.starttls","false").withProperty("recce.account.mail-from","sender@example.invalid").withProperty("recce.account.public-base-url","http://localhost:4200");
    }
    @Test void failsClosedForMissingOrUnsafePublicUrlConfiguration() {
        assertFalse(new SmtpAccountMailer(new MockEnvironment()).isConfigured());
        assertTrue(new SmtpAccountMailer(config(1)).isConfigured());
        assertFalse(new SmtpAccountMailer(config(1).withProperty("recce.account.smtp.host","smtp.example.invalid")).isConfigured());
        for(String url:new String[]{"http://public.invalid","https://user:password@example.invalid","https://example.invalid?redirect=bad","https://example.invalid#token=bad","not-a-url"}) {
            assertFalse(new SmtpAccountMailer(config(1).withProperty("recce.account.public-base-url",url)).isConfigured(),url);
        }
        assertTrue(new SmtpAccountMailer(config(1).withProperty("recce.account.public-base-url","https://app.example.invalid")).isConfigured());
    }
    @Test void writesExpectedEmailOnlyToAnIsolatedLoopbackSmtpSimulator() throws Exception {
        String proof="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        String text = smtpBody("RESET", proof);
        assertTrue(text.contains("/reset-password#token="+proof));
        assertFalse(text.contains("?token="));
        String confirmation = smtpBody("VERIFY_CODE", "012345");
        assertTrue(confirmation.contains("012345"));
        assertTrue(confirmation.contains("5 minutos"));
        assertTrue(confirmation.contains("Se não fizeste este pedido"));
        assertFalse(confirmation.contains("#token="));
        String welcome = smtpBody("WELCOME", "");
        assertTrue(welcome.contains("conta está ativa"));
        assertTrue(welcome.contains("http://localhost:4200/login"));
    }

    private String smtpBody(String purpose, String proof) throws Exception {
        try(ServerSocket server=new ServerSocket(0,1,InetAddress.getByName("127.0.0.1"))) {
            server.setSoTimeout(8000); ExecutorService executor=Executors.newSingleThreadExecutor();
            try {
                Future<String> message=executor.submit(()->{
                    try(Socket socket=server.accept()) {
                        socket.setSoTimeout(8000); BufferedReader in=new BufferedReader(new InputStreamReader(socket.getInputStream(),StandardCharsets.UTF_8));
                        PrintWriter out=new PrintWriter(new OutputStreamWriter(socket.getOutputStream(),StandardCharsets.UTF_8),true); out.print("220 localhost test\r\n"); out.flush();
                        StringBuilder data=new StringBuilder(); String line; boolean receiving=false;
                        while((line=in.readLine())!=null) {
                            if(receiving) { if(line.equals(".")) {receiving=false; out.print("250 received\r\n");} else {data.append(line).append('\n');} }
                            else if(line.startsWith("DATA")) {receiving=true;out.print("354 send\r\n");}
                            else if(line.startsWith("QUIT")) {out.print("221 bye\r\n");out.flush();break;}
                            else out.print("250 OK\r\n");
                            out.flush();
                        }
                        return data.toString();
                    }
                });
                new SmtpAccountMailer(config(server.getLocalPort())).send("recipient@example.invalid",purpose,proof);
                String sent=message.get(10,TimeUnit.SECONDS);
                assertTrue(sent.contains("recipient@example.invalid"));
                javax.mail.internet.MimeMessage decoded = new javax.mail.internet.MimeMessage(javax.mail.Session.getInstance(new java.util.Properties()), new ByteArrayInputStream(sent.getBytes(StandardCharsets.UTF_8)));
                return decoded.getContent().toString();
            } finally {executor.shutdownNow();}
        }
    }
}
