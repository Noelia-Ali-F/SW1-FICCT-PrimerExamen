package com.workflow.system.data.model;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "activity_diagrams")
public class ActivityDiagram {
  @Id private String id;

  @Indexed(unique = true)
  private String policyId;

  private List<Swimlane> swimlanes;
  private List<DiagramNode> nodes;
  private List<DiagramEdge> edges;

  private Integer version;
  private String createdBy;

  @CreatedDate private Instant createdAt;
  @LastModifiedDate private Instant updatedAt;

  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class Swimlane {
    private String id;
    private String name;
    private ResponsibleType responsibleType;
    private String responsibleId;
    /** Layout opcional del carril en el lienzo UML */
    private Double positionX;
    private Double positionY;
    private Double width;
    private Double height;
  }

  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class DiagramNode {
    private String id;
    private NodeType type;
    private String name;
    private String description;
    private String swimlaneId;
    private Double positionX;
    private Double positionY;
    private String formId;
    private Map<String, Object> metadata;
  }

  @Data
  @Builder
  @NoArgsConstructor
  @AllArgsConstructor
  public static class DiagramEdge {
    private String id;
    private String sourceNodeId;
    private String targetNodeId;
    private String label;
    private String condition;
    private EdgeType type;
  }
}

