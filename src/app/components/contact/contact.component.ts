import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.css'
})
export class ContactComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  public contactForm!: FormGroup;
  public readonly isSubmitting = signal<boolean>(false);
  public readonly isSubmitted = signal<boolean>(false);

  ngOnInit(): void {
    this.initForm();

    // Check for fragment (e.g., #inquiry-form) to scroll to it
    this.route.fragment.subscribe(fragment => {
      if (fragment) {
        setTimeout(() => {
          const element = document.getElementById(fragment);
          if (element) {
            const yOffset = -90;
            const y = element.getBoundingClientRect().top + window.scrollY + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
          }
        }, 150);
      }
    });
  }

  private initForm(): void {
    this.contactForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      type: ['Reservation', [Validators.required]],
      people: ['2', [Validators.required]],
      message: ['', [Validators.required, Validators.minLength(10)]]
    });

    // Handle type change to update default people count
    this.contactForm.get('type')?.valueChanges.subscribe(type => {
      if (type === 'Event' || type === 'Catering') {
        this.contactForm.get('people')?.setValue('20-50', { emitEvent: false });
      } else {
        this.contactForm.get('people')?.setValue('2', { emitEvent: false });
      }
    });
  }

  public getPeopleOptions(): { value: string; label: string }[] {
    const type = this.contactForm?.get('type')?.value;
    if (type === 'Event' || type === 'Catering') {
      return [
        { value: '10-20', label: '10 to 20 People' },
        { value: '20-50', label: '20 to 50 People' },
        { value: '50-100', label: '50 to 100 People' },
        { value: '100+', label: '100+ People' }
      ];
    }
    return [
      { value: '1', label: '1 Person' },
      { value: '2', label: '2 People' },
      { value: '3', label: '3 People' },
      { value: '4', label: '4 People' },
      { value: '5', label: '5 People' },
      { value: '6', label: '6 People' },
      { value: '7', label: '7 People' },
      { value: '8+', label: '8+ People' }
    ];
  }

  public onSubmit(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    // Simulate API call
    setTimeout(() => {
      this.isSubmitting.set(false);
      this.isSubmitted.set(true);
      this.contactForm.reset({
        name: '',
        email: '',
        type: 'Reservation',
        people: '2',
        message: ''
      });

      // Clear success banner after 5 seconds
      setTimeout(() => {
        this.isSubmitted.set(false);
      }, 5000);
    }, 1500);
  }
}
