package org.example.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaForwardController {

    @GetMapping({
            "/login",
            "/pecs",
            "/new-recce",
            "/recce-mode",
            "/offline-recces",
            "/notes",
            "/team-profile",
            "/settings",
            "/tutorial",
            "/rally/{id}",
            "/recce/{id}"
    })
    public String forwardAngularRoutes() {
        return "forward:/index.html";
    }
}
