import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  public readonly isMobileMenuOpen = signal<boolean>(false);

  public toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(val => !val);
  }

  public closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }
}
