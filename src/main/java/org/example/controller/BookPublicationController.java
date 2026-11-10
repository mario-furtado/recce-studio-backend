package org.example.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.example.service.BookPublicationService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.Map;

@RestController
@RequestMapping("/api/pecs/{pecId}/book-publication")
@CrossOrigin
public class BookPublicationController {
    private final BookPublicationService books;

    public BookPublicationController(BookPublicationService books) { this.books = books; }

    @PutMapping
    public ResponseEntity<Map<String, Long>> publish(@PathVariable String pecId, @RequestBody JsonNode snapshot) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(Collections.singletonMap("revision", books.publish(pecId, snapshot)));
    }
}
