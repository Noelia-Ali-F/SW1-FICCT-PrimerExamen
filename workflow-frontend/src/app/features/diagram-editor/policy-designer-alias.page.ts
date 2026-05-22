import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  standalone: true,
  template: ``
})
export class PolicyDesignerAliasPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  constructor() {
    const policyId = this.route.snapshot.paramMap.get('policyId');
    const queryParams = { ...this.route.snapshot.queryParams };
    if (policyId) {
      this.router.navigate(['/policies', policyId, 'diagram'], { queryParams });
    } else {
      this.router.navigate(['/policies']);
    }
  }
}

