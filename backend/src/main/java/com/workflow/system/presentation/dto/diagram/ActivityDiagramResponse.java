package com.workflow.system.presentation.dto.diagram;

import com.workflow.system.presentation.dto.form.DynamicFormSummaryResponse;
import com.workflow.system.data.model.EdgeType;
import com.workflow.system.data.model.NodeType;
import com.workflow.system.data.model.ResponsibleType;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ActivityDiagramResponse {
  String id;
  String policyId;
  List<SwimlaneDto> swimlanes;
  List<NodeDto> nodes;
  List<EdgeDto> edges;
  Integer version;
  String createdBy;
  Instant createdAt;
  Instant updatedAt;
  /** Formularios CU4 guardados para esta política (inventario por nodo). */
  List<DynamicFormSummaryResponse> dynamicForms;

  @Value
  @Builder
  public static class SwimlaneDto {
    String id;
    String name;
    ResponsibleType responsibleType;
    String responsibleId;
    Double positionX;
    Double positionY;
    Double width;
    Double height;
  }

  @Value
  @Builder
  public static class NodeDto {
    String id;
    NodeType type;
    String name;
    String description;
    String swimlaneId;
    Double positionX;
    Double positionY;
    String formId;
    Map<String, Object> metadata;
  }

  @Value
  @Builder
  public static class EdgeDto {
    String id;
    String sourceNodeId;
    String targetNodeId;
    String label;
    String condition;
    EdgeType type;
  }
}

