package org.example.entity;

import javax.persistence.*;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Entity
@Table(name = "invitation_quotas")
public class InvitationQuotaEntity {
    @Id
    private String ownerId;
    @Column(nullable = false, length = 200)
    private String issued = "";

    protected InvitationQuotaEntity() {}

    public InvitationQuotaEntity(String ownerId) { this.ownerId = ownerId; }

    public long record(long now, long window, int maximum) {
        List<Long> recent = Arrays.stream(issued.split(",")).filter(value -> !value.isEmpty())
                .map(Long::valueOf).filter(time -> time > now - window).collect(Collectors.toList());
        if (recent.size() >= maximum) {
            long oldest = recent.stream().mapToLong(Long::longValue).min().getAsLong();
            return (oldest + window - now + 999) / 1000;
        }
        recent.add(now);
        issued = recent.stream().map(String::valueOf).collect(Collectors.joining(","));
        return 0;
    }
}
