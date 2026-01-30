'use client';

import React, { useState, useEffect } from 'react';
import './orm_styles.css';
import CONFIG from '../config.json';
const CONFIGURATION = CONFIG.default || CONFIG;
// ============= GOOGLE CALENDAR CONFIG =============
const GOOGLE_CALENDAR_CONFIG = {
  apiKey: CONFIGURATION.google_calendar_config.apiKey,
  clientId: CONFIGURATION.google_calendar_config.clientId,
  calendarId: CONFIGURATION.google_calendar_config.calendarId,
  scope: CONFIGURATION.google_calendar_config.scope,
  discoveryDocs: CONFIGURATION.google_calendar_config.discoveryDocs,
};
// ============= GOOGLE CALENDAR COMPONENT =============
const GoogleCalendar = ({ onSelectSlot }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [gapi, setGapi] = useState(null);

  useEffect(() => {
    const loadGapi = async () => {
      try {
        const gapiModule = await import('gapi-script');
        const gapiClient = gapiModule.gapi;

        gapiClient.load('client:auth2', () => {
          gapiClient.client
            .init({
              apiKey: GOOGLE_CALENDAR_CONFIG.apiKey,
              clientId: GOOGLE_CALENDAR_CONFIG.clientId,
              scope: GOOGLE_CALENDAR_CONFIG.scope,
              discoveryDocs: GOOGLE_CALENDAR_CONFIG.discoveryDocs,
            })
            .then(() => {
              setGapi(gapiClient);
              setIsLoading(false);
            })
            .catch(() => {
              setError('Failed to initialize Google Calendar');
              setIsLoading(false);
            });
        });
      } catch {
        setError('Failed to load Google Calendar');
        setIsLoading(false);
      }
    };

    loadGapi();
  }, []);

  const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const fetchEvents = async () => {
    if (!gapi) return;
    try {
      setIsLoading(true);
      const startOfWeek = getStartOfWeek(currentWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 7);

      const response = await gapi.client.calendar.events.list({
        calendarId: GOOGLE_CALENDAR_CONFIG.calendarId,
        timeMin: startOfWeek.toISOString(),
        timeMax: endOfWeek.toISOString(),
        showDeleted: false,
        singleEvents: true,
        orderBy: 'startTime',
      });
      const items = response.result.items || [];
      console.log('Fetched events:', items);
      setEvents(items);
      setError(null);
    } catch (err) {
      console.error('Calendar API Error:', err);
      const errorMsg = err?.result?.error?.message || 'Unable to load calendar.';
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (gapi) fetchEvents();
  }, [currentWeek, gapi]);

  const navigateWeek = (direction) => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() + direction * 7);
    setCurrentWeek(newDate);
  };

  const formatDate = (date) => date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const formatTime = (hour) => `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`;

  const generateTimeSlots = () => {
    const slots = [];
    const startOfWeek = getStartOfWeek(currentWeek);
    for (let day = 0; day < 6; day++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + day);
      const endHour = day === 5 ? 14 : 18;
      for (let hour = 8; hour < endHour; hour++) {
        const slotTime = new Date(date);
        slotTime.setHours(hour, 0, 0, 0);
        const isBooked = events.some((event) => {
          const eventStart = new Date(event.start.dateTime || event.start.date);
          const eventEnd = new Date(event.end.dateTime || event.end.date);
          return slotTime >= eventStart && slotTime < eventEnd;
        });
        const isPast = slotTime < new Date();
        slots.push({ date: new Date(date), time: slotTime, hour, isBooked, isPast, dayIndex: day });
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();
  const days = [...new Set(timeSlots.map((s) => s.date.toDateString()))];

  if (isLoading && events.length === 0) {
    return <div className="calendar-loading"><p>Loading calendar...</p></div>;
  }

  if (error) {
    return <div className="calendar-error"><p>{error}</p><button className="btn" onClick={fetchEvents}>Try Again</button></div>;
  }

  return (
    <div className="google-calendar">
      <div className="calendar-nav">
        <button className="btn" onClick={() => navigateWeek(-1)}>← Previous</button>
        <h3>{formatDate(getStartOfWeek(currentWeek))} - {formatDate(new Date(getStartOfWeek(currentWeek).getTime() + 5 * 24 * 60 * 60 * 1000))}</h3>
        <button className="btn" onClick={() => navigateWeek(1)}>Next →</button>
      </div>
      <div className="calendar-grid">
        <div className="calendar-header">
          <div className="calendar-time-header">Time</div>
          {days.map((day) => <div key={day} className="calendar-day-header">{formatDate(new Date(day))}</div>)}
        </div>
        <div className="calendar-body">
          {[...Array(10)].map((_, i) => {
            const hour = 8 + i;
            return (
              <div key={hour} className="calendar-row">
                <div className="calendar-time">{formatTime(hour)}</div>
                {days.map((day, dayIndex) => {
                  const slot = timeSlots.find((s) => s.date.toDateString() === day && s.hour === hour);
                  if (!slot || (dayIndex === 5 && hour >= 14)) return <div key={`${day}-${hour}`} className="calendar-slot unavailable">—</div>;
                  return (
                    <div
                      key={`${day}-${hour}`}
                      className={`calendar-slot ${slot.isBooked ? 'booked' : slot.isPast ? 'past' : 'available'}`}
                      onClick={() => !slot.isBooked && !slot.isPast && onSelectSlot && onSelectSlot(slot.time)}
                    >
                      {slot.isBooked ? 'Booked' : slot.isPast ? '—' : 'Available'}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div className="calendar-legend">
        <span className="legend-item"><span className="legend-dot available"></span> Available</span>
        <span className="legend-item"><span className="legend-dot booked"></span> Booked</span>
        <span className="legend-item"><span className="legend-dot past"></span> Unavailable</span>
      </div>
    </div>
  );
};

// ============= MODAL COMPONENT =============
const AppointmentModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    date: '',
    time: '',
    service: '',
    message: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: Connect to backend/email service
    console.log('Appointment request:', formData);
    confirm('Thank you! We will confirm your appointment soon.');
    setFormData({
      name: '',
      email: '',
      phone: '',
      date: '',
      time: '',
      service: '',
      message: ''
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h2>Request an Appointment</h2>
        <form onSubmit={handleSubmit} className="appointment-form">
          <div className="form-group">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Your full name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="your@email.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone</label>
            <input
              id="phone"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              placeholder="(555) 123-4567"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="date">Preferred Date</label>
              <input
                id="date"
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="time">Preferred Time</label>
              <input
                id="time"
                type="time"
                name="time"
                value={formData.time}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="service">Service Type</label>
            <select
              id="service"
              name="service"
              value={formData.service}
              onChange={handleChange}
              required
            >
              <option value="">Select a service</option>
              <option value="oil-change">Oil Change</option>
              <option value="brake-service">Brake Service</option>
              <option value="tire-rotation">Tire Rotation</option>
              <option value="battery">Battery Service</option>
              <option value="maintenance">General Maintenance</option>
              <option value="repair">General Repair</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="message">Additional Notes</label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              placeholder="Tell us about your vehicle or special requests..."
              rows="4"
            />
          </div>

          <button type="submit" className="btn btn-primary">
            Request Appointment
          </button>
        </form>
      </div>
    </div>
  );
};

// ============= HOME PAGE =============
const HomePage = ({ onOpenModal }) => {
  return (
    <main className="page home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-logo-container">
            <img src="/1769609823422.png" alt="Old Reliable Automotive Logo" className="hero-logo" />
          </div>
        </div>
        <div className="hero-accent"></div>
      </section>

      {/* Services Overview 
      <section className="services-preview">
        <h2>Our Services</h2>
        <div className="services-grid">
          <div className="service-card">
            <div className="service-icon">🔧</div>
            <h3>General Maintenance</h3>
            <p>Oil changes, filter replacements, and routine upkeep</p>
          </div>
          <div className="service-card">
            <div className="service-icon">🛞</div>
            <h3>Tire Service</h3>
            <p>Rotation, balancing, and replacement</p>
          </div>
          <div className="service-card">
            <div className="service-icon">🔋</div>
            <h3>Battery & Electrical</h3>
            <p>Testing, replacement, and troubleshooting</p>
          </div>
          <div className="service-card">
            <div className="service-icon">🚗</div>
            <h3>Brake Service</h3>
            <p>Inspection, repair, and replacement</p>
          </div>
        </div>
      </section>
*/}
      {/* Why Choose Us 
      <section className="why-us">
        <h2>Why Choose Old Reliable?</h2>
        <div className="features">
          <div className="feature">
            <div className="feature-number">1</div>
            <h3>Mobile Service</h3>
            <p>We come to you. No need to take time off work.</p>
          </div>
          <div className="feature">
            <div className="feature-number">2</div>
            <h3>Expert Technicians</h3>
            <p>Years of experience with all makes and models</p>
          </div>
          <div className="feature">
            <div className="feature-number">3</div>
            <h3>Honest Pricing</h3>
            <p>Transparent quotes with no hidden fees</p>
          </div>
          <div className="feature">
            <div className="feature-number">4</div>
            <h3>Quality Guarantee</h3>
            <p>All work backed by our satisfaction guarantee</p>
          </div>
        </div>
      </section>
*/}
      {/* Google Calendar Integration */}
      <section className="calendar-section">
        <h2>View Our Availability</h2>
        <p>Check our calendar to see available appointment slots</p>
        <GoogleCalendar onSelectSlot={(time) => {
          console.log('Selected slot:', time);
          onOpenModal();
        }} />
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <h2>Ready to Get Your Vehicle Serviced?</h2>
        <button className="btn btn-primary btn-lg" onClick={onOpenModal}>
          Schedule Your Service Today
        </button>
      </section>
    </main>
  );
};

// ============= CONTACT PAGE =============
const ContactPage = ({ onOpenModal }) => {
  return (
    <main className="page contact-page">
      <div className="page-header">
        <h1>Contact Us</h1>
        <p>Get in touch with Old Reliable Automotive</p>
      </div>

      <section className="contact-main">
        <div className="contact-info">
          <h2>Get in Touch</h2>

          <div className="contact-method">
            <h3>📞 Phone</h3>
            <p><a href="tel:+15551234567">(555) 123-4567</a></p>
            <p className="note">Call us Monday-Friday, 8am-6pm | Saturday 9am-2pm</p>
          </div>

          <div className="contact-method">
            <h3>✉️ Email</h3>
            <p><a href="mailto:oldreliablemotive@gmail.com">oldreliablemotive@gmail.com</a></p>
            <p className="note">We typically respond within 2 hours</p>
          </div>

          <div className="contact-method">
            <h3>📍 Service Area</h3>
            <p>We provide mobile service throughout the Metro Atlanta area</p>
          </div>
        </div>

        <div className="social-media">
          <h2>Follow Us</h2>
          <div className="social-links">
            {/*
            <a href="https://facebook.com" className="social-link" target="_blank" rel="noopener noreferrer">
              <span>f</span> Facebook
            </a>
            */}
            <a href="https://instagram.com" className="social-link" target="_blank" rel="noopener noreferrer">
              <span>📷</span> Instagram
            </a>
            {/*
            <a href="https://twitter.com" className="social-link" target="_blank" rel="noopener noreferrer">
              <span>𝕏</span> Twitter
            </a>
            <a href="https://youtube.com" className="social-link" target="_blank" rel="noopener noreferrer">
              <span>▶️</span> YouTube
            </a>
            */}
          </div>
        </div>
      </section>

      <section className="contact-form-section">
        <h2>Send Us a Message</h2>
        <form className="contact-form">
          <div className="form-group">
            <label htmlFor="contact-name">Name</label>
            <input id="contact-name" type="text" placeholder="Your name" required />
          </div>
          <div className="form-group">
            <label htmlFor="contact-email">Email</label>
            <input id="contact-email" type="email" placeholder="your@email.com" required />
          </div>
          <div className="form-group">
            <label htmlFor="contact-phone">Phone</label>
            <input id="contact-phone" type="tel" placeholder="(555) 123-4567" />
          </div>
          <div className="form-group">
            <label htmlFor="contact-subject">Subject</label>
            <input id="contact-subject" type="text" placeholder="What is this about?" required />
          </div>
          <div className="form-group">
            <label htmlFor="contact-message">Message</label>
            <textarea id="contact-message" placeholder="Your message..." rows="5" required />
          </div>
          <button type="submit" className="btn btn-primary">Send Message</button>
        </form>
      </section>

      <section className="quick-booking">
        <h2>Quick Booking</h2>
        <p>Need an appointment? Click below to get started:</p>
        <button className="btn btn-primary" onClick={onOpenModal}>
          Book Appointment
        </button>
      </section>
    </main>
  );
};

// ============= FAQ & TESTIMONIES PAGE =============
const FAQTestimoniesPage = () => {
  const [expandedFAQ, setExpandedFAQ] = useState(null);

  const faqs = [
    {
      id: 1,
      question: "Do you come to me or do I need to come to your shop?",
      answer: "We come to you! Old Reliable Automotive is a mobile service. We'll arrive at your location with our equipment to service your vehicle."
    },
    {
      id: 2,
      question: "What makes and models do you service?",
      answer: "We service all makes and models of vehicles - domestic and foreign. Our technicians have experience with vehicles from the 1980s to the latest models."
    },
    {
      id: 3,
      question: "How far will you travel?",
      answer: "We service the entire metro area. Contact us directly to confirm we cover your location."
    },
    {
      id: 4,
      question: "What if I need a major repair?",
      answer: "We handle most repairs on-site. For major work requiring specific equipment, we'll discuss options with you and provide referrals to trusted partners."
    },
    {
      id: 5,
      question: "Do you offer any warranties?",
      answer: "Yes! All our work comes with a satisfaction guarantee. We stand behind our repairs and want you completely satisfied."
    },
    {
      id: 6,
      question: "Can I book online?",
      answer: "Absolutely! Use our appointment booking system on this website. You can also call or email us to request a time slot."
    }
  ];

  const testimonials = [
    {
      id: 1,
      name: "Sarah M.",
      rating: 5,
      text: "Incredibly convenient having the mechanic come to my home. The service was professional and the pricing was fair. Highly recommend!"
    },
    {
      id: 2,
      name: "John D.",
      rating: 5,
      text: "Finally found a mechanic I can trust. Been using Old Reliable for 2 years now. They treat you right and do quality work."
    },
    {
      id: 3,
      name: "Maria L.",
      rating: 5,
      text: "Saved me so much time not having to drive to a shop. The technician was knowledgeable and explained everything clearly."
    },
    {
      id: 4,
      name: "Robert T.",
      rating: 5,
      text: "Best service I've had in years. No upselling, no hidden fees. Just honest, reliable work. That's the Old Reliable difference!"
    }
  ];

  const toggleFAQ = (id) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  return (
    <main className="page faq-testimonies-page">
      <div className="page-header">
        <h1>FAQ & Testimonials</h1>
        <p>Questions? See what our customers have to say.</p>
      </div>

      {/* Testimonials Section */}
      <section className="testimonials">
        <h2>What Our Customers Say</h2>
        <div className="testimonials-grid">
          {testimonials.map(testimonial => (
            <div key={testimonial.id} className="testimonial-card">
              <div className="rating">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <span key={i} className="star">⭐</span>
                ))}
              </div>
              <p className="testimonial-text">"{testimonial.text}"</p>
              <p className="testimonial-author">— {testimonial.name}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq">
        <h2>Frequently Asked Questions</h2>
        <div className="faq-list">
          {faqs.map(faq => (
            <div key={faq.id} className="faq-item">
              <button
                className="faq-question"
                onClick={() => toggleFAQ(faq.id)}
                aria-expanded={expandedFAQ === faq.id}
              >
                <span>{faq.question}</span>
                <span className="faq-toggle">{expandedFAQ === faq.id ? '−' : '+'}</span>
              </button>
              {expandedFAQ === faq.id && (
                <div className="faq-answer">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
};

// ============= NAVIGATION =============
const Navigation = ({ currentPage, onPageChange, onOpenModal }) => {

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-logo">
          <span className="logo-icon">⚙️{CONFIGURATION.header.business_name}</span>
        </div>
        <ul className="nav-menu">
          <li>
            <button
              className={`nav-link ${currentPage === 'home' ? 'active' : ''}`}
              onClick={() => onPageChange('home')}
            >
              Home
            </button>
          </li>
          <li>
            <button
              className={`nav-link ${currentPage === 'contact' ? 'active' : ''}`}
              onClick={() => onPageChange('contact')}
            >
              Contact
            </button>
          </li>
          <li>
            <button
              className="nav-link nav-book-btn"
              onClick={onOpenModal}
            >
              Book an Appointment
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
};

// ============= FOOTER =============
const Footer = () => {
  const footerConfig = CONFIGURATION.footer;
  const contactConfig = CONFIGURATION.contact;
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h4>{CONFIGURATION.footer.copyright}</h4>
          <p>{CONFIGURATION.footer.disclaimer}</p>
        </div>
        <div className="footer-section">
          <h4>Hours</h4>
          <p>Mon: {footerConfig.hours.monday}<br />
            Tue: {footerConfig.hours.tuesday}<br />
            Wed: {footerConfig.hours.wednesday}<br />
            Thu: {footerConfig.hours.thursday}<br />
            Fri: {footerConfig.hours.friday}<br />
            Sat: {footerConfig.hours.saturday}<br />
            Sun: {footerConfig.hours.sunday}</p>
        </div>
        <div className="footer-section">
          <h4>Contact</h4>
          <p><a href="tel:{contactConfig.phone}">{contactConfig.phone}</a><br />
            <a href={`mailto:${contactConfig.email}`}>{contactConfig.email}</a>  </p>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; 2026 Old Reliable Automotive. All rights reserved.</p>
      </div>
    </footer>
  );
};

// ============= MAIN APP =============
export default function ORMWebpage() {
  const [currentPage, setCurrentPage] = useState('home');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage onOpenModal={() => setIsModalOpen(true)} />;
      case 'contact':
        return <ContactPage onOpenModal={() => setIsModalOpen(true)} />;
      case 'faq':
        return <FAQTestimoniesPage />;
      default:
        return <HomePage onOpenModal={() => setIsModalOpen(true)} />;
    }
  };

  return (
    <div className="app">
      <Navigation currentPage={currentPage} onPageChange={setCurrentPage} onOpenModal={() => setIsModalOpen(true)} />
      <AppointmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      {renderPage()}
      <Footer />
    </div>
  );
}
