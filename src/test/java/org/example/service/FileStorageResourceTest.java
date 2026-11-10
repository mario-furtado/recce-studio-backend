package org.example.service;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.Resource;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.util.StreamUtils;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;

import java.io.ByteArrayInputStream;
import java.io.InputStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class FileStorageResourceTest {
    @Test
    void s3LengthDoesNotConsumeTheStreamAndEachReadCanOpenAgain() throws Exception {
        S3Client s3 = mock(S3Client.class);
        FileStorageService storage = new FileStorageService("target/shared-rally-test-uploads", "s3",
                "fixture", "", "us-east-1", "", "", "path");
        ReflectionTestUtils.setField(storage, "s3Client", s3);
        String key = "pecs/example/media.webm";
        byte[] bytes = {1, 2, 3, 4};
        HeadObjectRequest head = HeadObjectRequest.builder().bucket("fixture").key(key).build();
        GetObjectRequest get = GetObjectRequest.builder().bucket("fixture").key(key).build();
        when(s3.headObject(head)).thenReturn(HeadObjectResponse.builder().contentLength((long) bytes.length).build());
        when(s3.getObject(get)).thenAnswer(invocation ->
                new ResponseInputStream<>(GetObjectResponse.builder().build(), new ByteArrayInputStream(bytes)));

        Resource resource = storage.loadAsResource(key);
        assertEquals(bytes.length, resource.contentLength());
        assertTrue(resource.isReadable());
        verify(s3, never()).getObject(any(GetObjectRequest.class));
        for (int read = 0; read < 2; read++) {
            try (InputStream stream = resource.getInputStream()) {
                assertArrayEquals(bytes, StreamUtils.copyToByteArray(stream));
            }
        }
        verify(s3).headObject(head);
        verify(s3, times(2)).getObject(get);
    }
}
