package com.workflow.system.business.mapper;

import com.workflow.system.data.model.ActivityDiagram;
import com.workflow.system.presentation.dto.diagram.ActivityDiagramResponse;
import com.workflow.system.presentation.dto.form.DynamicFormSummaryResponse;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class ActivityDiagramMapper {
  public ActivityDiagramResponse toResponse(ActivityDiagram d) {
    return toResponse(d, List.of());
  }

  public ActivityDiagramResponse toResponse(
      ActivityDiagram d, List<DynamicFormSummaryResponse> dynamicForms) {
    List<ActivityDiagramResponse.SwimlaneDto> swimlanes =
        d.getSwimlanes() == null
            ? List.of()
            : d.getSwimlanes().stream()
                .map(
                    s ->
                        ActivityDiagramResponse.SwimlaneDto.builder()
                            .id(s.getId())
                            .name(s.getName())
                            .responsibleType(s.getResponsibleType())
                            .responsibleId(s.getResponsibleId())
                            .positionX(s.getPositionX())
                            .positionY(s.getPositionY())
                            .width(s.getWidth())
                            .height(s.getHeight())
                            .build())
                .toList();

    List<ActivityDiagramResponse.NodeDto> nodes =
        d.getNodes() == null
            ? List.of()
            : d.getNodes().stream()
                .map(
                    n ->
                        ActivityDiagramResponse.NodeDto.builder()
                            .id(n.getId())
                            .type(n.getType())
                            .name(n.getName())
                            .description(n.getDescription())
                            .swimlaneId(n.getSwimlaneId())
                            .positionX(n.getPositionX())
                            .positionY(n.getPositionY())
                            .formId(n.getFormId())
                            .metadata(n.getMetadata())
                            .build())
                .toList();

    List<ActivityDiagramResponse.EdgeDto> edges =
        d.getEdges() == null
            ? List.of()
            : d.getEdges().stream()
                .map(
                    e ->
                        ActivityDiagramResponse.EdgeDto.builder()
                            .id(e.getId())
                            .sourceNodeId(e.getSourceNodeId())
                            .targetNodeId(e.getTargetNodeId())
                            .label(e.getLabel())
                            .condition(e.getCondition())
                            .type(e.getType())
                            .build())
                .toList();

    return ActivityDiagramResponse.builder()
        .id(d.getId())
        .policyId(d.getPolicyId())
        .swimlanes(swimlanes)
        .nodes(nodes)
        .edges(edges)
        .version(d.getVersion())
        .createdBy(d.getCreatedBy())
        .createdAt(d.getCreatedAt())
        .updatedAt(d.getUpdatedAt())
        .dynamicForms(dynamicForms != null ? dynamicForms : List.of())
        .build();
  }
}

