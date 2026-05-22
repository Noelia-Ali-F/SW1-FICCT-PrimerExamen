package com.workflow.system.presentation.controller;

import com.workflow.system.business.service.ReportService;
import com.workflow.system.data.model.ProcessStatus;
import com.workflow.system.data.model.TaskStatus;
import com.workflow.system.presentation.dto.report.BottleneckResponse;
import com.workflow.system.presentation.dto.report.DashboardReportResponse;
import com.workflow.system.presentation.dto.report.MonthlyCountResponse;
import com.workflow.system.presentation.dto.report.RecentItemResponse;
import com.workflow.system.presentation.dto.report.WorkflowKpiResponseDto;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {
  private final ReportService reportService;

  @GetMapping("/dashboard")
  public DashboardReportResponse dashboard() {
    return reportService.dashboard();
  }

  @GetMapping("/processes-by-status")
  public Map<ProcessStatus, Long> processesByStatus() {
    return reportService.processesByStatus();
  }

  @GetMapping("/tasks-by-status")
  public Map<TaskStatus, Long> tasksByStatus() {
    return reportService.tasksByStatus();
  }

  @GetMapping("/processes-monthly")
  public List<MonthlyCountResponse> processesMonthly(
      @RequestParam(name = "months", defaultValue = "4") int months) {
    return reportService.processesMonthly(months);
  }

  @GetMapping("/bottlenecks")
  public List<BottleneckResponse> bottlenecks(
      @RequestParam(name = "top", defaultValue = "5") int top) {
    return reportService.bottlenecks(top);
  }

  @GetMapping("/recent")
  public List<RecentItemResponse> recent(@RequestParam(name = "limit", defaultValue = "6") int limit) {
    return reportService.recent(limit);
  }

  @GetMapping("/workflow-kpis")
  public WorkflowKpiResponseDto workflowKpis(
      @RequestParam(name = "policyId", required = false) String policyId,
      @RequestParam(name = "status", required = false) ProcessStatus status,
      @RequestParam(name = "responsibleId", required = false) String responsibleId,
      @RequestParam(name = "startDate", required = false) String startDate,
      @RequestParam(name = "endDate", required = false) String endDate) {
    return reportService.workflowKpis(policyId, status, responsibleId, startDate, endDate);
  }
}

