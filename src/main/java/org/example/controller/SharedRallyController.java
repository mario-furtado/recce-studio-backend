package org.example.controller;

import com.fasterxml.jackson.databind.node.ObjectNode;
import org.example.dto.GpsPointDTO;
import org.example.dto.PecAssetDTO;
import org.example.dto.PecDTO;
import org.example.dto.PecOverviewDTO;
import org.example.entity.NoteEntity;
import org.example.entity.RallyEntity;
import org.example.repository.PecRepository;
import org.example.repository.RallyReadGrantRepository;
import org.example.service.*;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import software.amazon.awssdk.services.s3.model.S3Exception;

import javax.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/shared-rallies")
@CrossOrigin(methods = {RequestMethod.GET, RequestMethod.HEAD})
public class SharedRallyController {
    private final RallyReadGrantRepository grants;
    private final PecRepository pecs;
    private final CrewService crews;
    private final TenantContext tenant;
    private final HttpServletRequest request;
    private final PecService pecService;
    private final PecAssetService assets;
    private final NoteExcelParserService notes;
    private final BookPublicationService books;

    public SharedRallyController(RallyReadGrantRepository grants, PecRepository pecs, CrewService crews,
                                 TenantContext tenant, HttpServletRequest request, PecService pecService,
                                 PecAssetService assets, NoteExcelParserService notes, BookPublicationService books) {
        this.grants = grants;
        this.pecs = pecs;
        this.crews = crews;
        this.tenant = tenant;
        this.request = request;
        this.pecService = pecService;
        this.assets = assets;
        this.notes = notes;
        this.books = books;
    }

    @GetMapping
    public List<RallyView> list() {
        requireEnabled();
        return grants.listVisible(tenant.requireAccountId()).stream().map(RallyView::new).collect(Collectors.toList());
    }

    @GetMapping("/{rallyId}")
    public RallyDetail detail(@PathVariable String rallyId) {
        RallyEntity rally = requireRally(rallyId);
        return new RallyDetail(rally, pecService.getPecsByRally(rallyId));
    }

    @GetMapping("/{rallyId}/pecs/{pecId}")
    public PecView pec(@PathVariable String rallyId, @PathVariable String pecId) {
        requirePec(rallyId, pecId);
        PecAssetDTO media = assets.getAssets(pecId);
        return new PecView(pecService.getPecOverview(pecId), media,
                notes.getNotesByPecId(pecId).stream().map(NoteView::new).collect(Collectors.toList()));
    }

    @RequestMapping(path = "/{rallyId}", method = RequestMethod.HEAD)
    public ResponseEntity<Void> checkRallyAccess(@PathVariable String rallyId) {
        requireRally(rallyId);
        return ResponseEntity.noContent().build();
    }

    @RequestMapping(path = "/{rallyId}/pecs/{pecId}", method = RequestMethod.HEAD)
    public ResponseEntity<Void> checkPecAccess(@PathVariable String rallyId, @PathVariable String pecId) {
        requirePec(rallyId, pecId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{rallyId}/pecs/{pecId}/gps/track")
    public List<GpsPointDTO> track(@PathVariable String rallyId, @PathVariable String pecId) {
        requirePec(rallyId, pecId);
        try {
            return assets.getGpsTrack(pecId);
        } catch (IllegalArgumentException ex) {
            throw new AccountFlowException(HttpStatus.BAD_REQUEST, "O traçado GPS não é válido.");
        } catch (RuntimeException ex) {
            throw new AccountFlowException(HttpStatus.SERVICE_UNAVAILABLE, "O traçado GPS está temporariamente indisponível.");
        }
    }

    @GetMapping("/{rallyId}/pecs/{pecId}/book-publication")
    public ResponseEntity<ObjectNode> book(@PathVariable String rallyId, @PathVariable String pecId) {
        requirePec(rallyId, pecId);
        return books.read(pecId).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/{rallyId}/pecs/{pecId}/video")
    public ResponseEntity<Resource> video(@PathVariable String rallyId, @PathVariable String pecId) {
        requirePec(rallyId, pecId);
        if (!assets.getAssets(pecId).isHasVideo()) throw unavailable();
        return media(() -> assets.getVideoResource(pecId), assets.getVideoContentType(pecId));
    }

    @GetMapping("/{rallyId}/pecs/{pecId}/audio")
    public ResponseEntity<Resource> audio(@PathVariable String rallyId, @PathVariable String pecId) {
        requirePec(rallyId, pecId);
        if (!assets.getAssets(pecId).isHasAudio()) throw unavailable();
        return media(() -> assets.getAudioResource(pecId), assets.getAudioContentType(pecId));
    }

    private ResponseEntity<Resource> media(java.util.function.Supplier<Resource> load, String type) {
        Resource content;
        try {
            content = load.get();
        } catch (S3Exception ex) {
            if (ex.statusCode() == 404) throw unavailable();
            throw new AccountFlowException(HttpStatus.SERVICE_UNAVAILABLE, "O ficheiro está temporariamente indisponível.");
        } catch (RuntimeException ex) {
            throw new AccountFlowException(HttpStatus.SERVICE_UNAVAILABLE, "O ficheiro está temporariamente indisponível.");
        }
        if (!content.isReadable()) throw unavailable();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .contentType(MediaType.parseMediaType(type))
                .header("X-Content-Type-Options", "nosniff")
                .body(content);
    }

    private RallyEntity requireRally(String rallyId) {
        requireEnabled();
        RallyEntity rally = grants.findVisible(tenant.requireAccountId(), rallyId).orElseThrow(SharedRallyController::unavailable);
        // Reuse the tenant-filtered readers only after validating this specific rally grant.
        request.setAttribute(TenantContext.TEAM_PROFILE_ID_ATTRIBUTE, rally.getTeamProfileId());
        return rally;
    }

    private void requirePec(String rallyId, String pecId) {
        requireRally(rallyId);
        if (!pecs.existsByIdAndRallyId(pecId, rallyId)) throw unavailable();
    }

    private void requireEnabled() {
        if (!crews.enabled()) throw new AccountFlowException(HttpStatus.FORBIDDEN, "A consulta partilhada não está disponível.");
    }

    private static ResourceNotFoundException unavailable() {
        return new ResourceNotFoundException("Recurso indisponível.");
    }

    @lombok.Getter
    public static class RallyView {
        private final String id;
        private final String name;
        private final String status;
        private final String surface;

        RallyView(RallyEntity rally) {
            id = rally.getId();
            name = rally.getName();
            status = rally.getStatus();
            surface = rally.getSurface();
        }
    }

    @lombok.Getter
    public static class RallyDetail extends RallyView {
        private final List<PecDTO> pecs;

        RallyDetail(RallyEntity rally, List<PecDTO> pecs) {
            super(rally);
            this.pecs = pecs;
        }
    }

    @lombok.Getter
    public static class PecView {
        private final PecOverviewDTO pec;
        private final boolean hasVideo;
        private final boolean hasAudio;
        private final List<NoteView> notes;

        PecView(PecOverviewDTO pec, PecAssetDTO assets, List<NoteView> notes) {
            this.pec = pec;
            hasVideo = assets.isHasVideo();
            hasAudio = assets.isHasAudio();
            this.notes = notes;
        }
    }

    @lombok.Getter
    public static class NoteView {
        private final Long id;
        private final String text;
        private final String speedRating;
        private final Double originalTimestamp;
        private final Double latitude;
        private final Double longitude;

        NoteView(NoteEntity note) {
            id = note.getId();
            text = note.getText();
            speedRating = note.getSpeedRating();
            originalTimestamp = note.getOriginalTimestamp();
            latitude = note.getLatitude();
            longitude = note.getLongitude();
        }
    }
}
