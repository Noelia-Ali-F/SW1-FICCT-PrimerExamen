package com.workflow.system.business.exception;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(ResourceNotFoundException.class)
  public ResponseEntity<Map<String, Object>> handleNotFound(ResourceNotFoundException ex) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(base("NOT_FOUND", ex.getMessage()));
  }

  @ExceptionHandler(BusinessRuleException.class)
  public ResponseEntity<Map<String, Object>> handleBusiness(BusinessRuleException ex) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(base("BUSINESS_RULE", ex.getMessage()));
  }

  @ExceptionHandler(DiagramInvalidException.class)
  public ResponseEntity<Map<String, Object>> handleDiagramInvalid(DiagramInvalidException ex) {
    Map<String, Object> body = base("DIAGRAM_INVALID", ex.getMessage());
    body.put("errors", ex.getErrors());
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
    Map<String, Object> body = base("VALIDATION_ERROR", "Datos inválidos");
    Map<String, String> fields = new LinkedHashMap<>();
    for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
      fields.put(fe.getField(), fe.getDefaultMessage());
    }
    body.put("fields", fields);
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<Map<String, Object>> handleGeneric(Exception ex) {
    // Importante para troubleshooting: dejamos traza en logs.
    log.error("Unhandled exception", ex);
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(base("INTERNAL_ERROR", "Error inesperado"));
  }

  private static Map<String, Object> base(String code, String message) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("ok", false);
    m.put("code", code);
    m.put("message", message);
    m.put("ts", Instant.now().toString());
    return m;
  }
}

