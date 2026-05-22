package com.workflow.system.presentation.dto.diagram;

import com.workflow.system.data.model.EdgeType;
import com.workflow.system.data.model.NodeType;
import com.workflow.system.data.model.ResponsibleType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;
import lombok.Data;

@Data
public class SaveActivityDiagramRequest {
  @NotBlank(message = "createdBy es obligatorio")
  private String createdBy;

  // opcional: si no viene, el backend usará la versión actual de la policy
  private Integer version;

  @Valid @NotNull(message = "swimlanes es obligatorio")
  private List<SwimlaneDto> swimlanes;

  @Valid @NotEmpty(message = "nodes es obligatorio")
  private List<NodeDto> nodes;

  @Valid @NotNull(message = "edges es obligatorio")
  private List<EdgeDto> edges;

  @Data
  public static class SwimlaneDto {
    @NotBlank(message = "swimlane.id es obligatorio")
    private String id;

    @NotBlank(message = "swimlane.name es obligatorio")
    private String name;

    @NotNull(message = "swimlane.responsibleType es obligatorio")
    private ResponsibleType responsibleType;

    @NotBlank(message = "swimlane.responsibleId es obligatorio")
    private String responsibleId;

    private Double positionX;
    private Double positionY;
    private Double width;
    private Double height;
  }

  @Data
  public static class NodeDto {
    @NotBlank(message = "node.id es obligatorio")
    private String id;

    @NotNull(message = "node.type es obligatorio")
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
  public static class EdgeDto {
    @NotBlank(message = "edge.id es obligatorio")
    private String id;

    @NotBlank(message = "edge.sourceNodeId es obligatorio")
    private String sourceNodeId;

    @NotBlank(message = "edge.targetNodeId es obligatorio")
    private String targetNodeId;

    private String label;
    private String condition;
    private EdgeType type;
  }
}

