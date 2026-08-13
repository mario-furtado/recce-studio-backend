import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SharedProperties } from './modules/core/shared/shared-properties';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'recce-studio';
  isInstallBannerVisible = false;
  isIosInstallHelp = false;
  private deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
  private readonly installDismissedKey = 'recce_install_banner_dismissed';

  constructor(private readonly shared: SharedProperties) {}

  ngOnInit(): void {
    this.refreshInstallBanner();
  }

  @HostListener('window:beforeinstallprompt', ['$event'])
  onBeforeInstallPrompt(event: BeforeInstallPromptEvent): void {
    event.preventDefault();
    this.deferredInstallPrompt = event;
    this.isIosInstallHelp = false;
    this.isInstallBannerVisible = !this.wasInstallBannerDismissed() && !this.isRunningStandalone();
  }

  @HostListener('window:appinstalled')
  onAppInstalled(): void {
    this.deferredInstallPrompt = null;
    this.dismissInstallBanner();
  }

  async installApp(): Promise<void> {
    if (!this.deferredInstallPrompt) return;

    const prompt = this.deferredInstallPrompt;
    this.deferredInstallPrompt = null;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === 'accepted') {
      this.dismissInstallBanner();
      return;
    }
    this.refreshInstallBanner();
  }

  dismissInstallBanner(): void {
    localStorage.setItem(this.installDismissedKey, 'true');
    this.isInstallBannerVisible = false;
  }

  private refreshInstallBanner(): void {
    if (this.wasInstallBannerDismissed() || this.isRunningStandalone()) {
      this.isInstallBannerVisible = false;
      return;
    }

    this.isIosInstallHelp = this.isIos();
    this.isInstallBannerVisible = this.isIosInstallHelp;
  }

  private wasInstallBannerDismissed(): boolean {
    return localStorage.getItem(this.installDismissedKey) === 'true';
  }

  private isRunningStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
    return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
  }

  private isIos(): boolean {
    if (typeof window === 'undefined') return false;
    const userAgent = window.navigator.userAgent.toLowerCase();
    const platform = window.navigator.platform;
    const maxTouchPoints = window.navigator.maxTouchPoints || 0;
    return /iphone|ipad|ipod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
  }
}
