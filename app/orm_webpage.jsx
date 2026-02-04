'use client';

import React, { useState, useEffect } from 'react';
import './orm_styles.css';
import CONFIG from '../config.json';
const CONFIGURATION = CONFIG.default || CONFIG;
// ============= GOOGLE CALENDAR CONFIG =============
const GOOGLE_CALENDAR_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY || CONFIGURATION.google_calendar_config?.apiKey || '',
  clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || CONFIGURATION.google_calendar_config?.clientId || '',
  calendarId: process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_ID || CONFIGURATION.google_calendar_config?.calendarId || '',
  scope: process.env.NEXT_PUBLIC_GOOGLE_SCOPE || CONFIGURATION.google_calendar_config?.scope || 'https://www.googleapis.com/auth/calendar.readonly',
  discoveryDocs: CONFIGURATION.google_calendar_config?.discoveryDocs || ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
};
// ============= GOOGLE CALENDAR COMPONENT =============
const GoogleCalendar = ({ onSelectSlot }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [gapi, setGapi] = useState(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0); // For mobile view

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

  const formatDayShort = (date) => date.toLocaleDateString('en-US', { weekday: 'short' });
  const selectedDay = days[selectedDayIndex];
  const selectedDaySlots = timeSlots.filter((s) => s.dayIndex === selectedDayIndex);

  return (
    <div className="google-calendar">
      <div className="calendar-nav">
        <button className="btn calendarBtn" onClick={() => navigateWeek(-1)}>← Previous</button>
        <h3 className="calendar-nav-title">{formatDate(getStartOfWeek(currentWeek))} - {formatDate(new Date(getStartOfWeek(currentWeek).getTime() + 5 * 24 * 60 * 60 * 1000))}</h3>
        <button className="btn calendarBtn" onClick={() => navigateWeek(1)}>Next →</button>
      </div>

      {/* Mobile Day Tabs */}
      <div className="calendar-day-tabs">
        {days.map((day, index) => (
          <button
            key={day}
            className={`day-tab ${selectedDayIndex === index ? 'active' : ''}`}
            onClick={() => setSelectedDayIndex(index)}
          >
            <span className="day-tab-name">{formatDayShort(new Date(day))}</span>
            <span className="day-tab-date">{new Date(day).getDate()}</span>
          </button>
        ))}
      </div>

      {/* Mobile Single Day View */}
      <div className="calendar-mobile">
        <div className="calendar-mobile-header">
          {formatDate(new Date(selectedDay))}
        </div>
        <div className="calendar-mobile-slots">
          {selectedDaySlots.map((slot) => {
            const isUnavailable = selectedDayIndex === 5 && slot.hour >= 14;
            if (isUnavailable) return null;
            return (
              <div
                key={`mobile-${slot.hour}`}
                className={`calendar-mobile-slot ${slot.isBooked ? 'booked' : slot.isPast ? 'past' : 'available'}`}
                onClick={() => !slot.isBooked && !slot.isPast && onSelectSlot && onSelectSlot(slot.time)}
              >
                <span className="mobile-slot-time">{formatTime(slot.hour)}</span>
                <span className="mobile-slot-status">
                  {slot.isBooked ? 'Booked' : slot.isPast ? 'Unavailable' : 'Available'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop Grid View */}
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

/* ============= MODAL COMPONENT (PRESERVED FOR REFERENCE) =============
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
============= END MODAL COMPONENT =============*/

// ============= HERO HEADER (persistent across all pages) =============
const HeroHeader = ({ settings }) => {
  const logoSrc = settings?.heroLogo || '/hero-logo-nobackground.png';

  return (
    <section className="hero">
      <div className="hero-content">
        <div className="hero-logo-container">
          <img src={logoSrc} alt="Old Reliable Automotive Logo" className="hero-logo" />
        </div>
      </div>
      <div className="hero-accent"></div>
    </section>
  );
};

// ============= HOME PAGE =============
const HomePage = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const services = [
    { icon: '🔧', title: 'General Maintenance', desc: 'Oil changes, filter replacements, and routine upkeep' },
    { icon: '🛞', title: 'Tire Service', desc: 'Rotation, balancing, and replacement' },
    { icon: '🔋', title: 'Battery & Electrical', desc: 'Testing, replacement, and troubleshooting' },
    { icon: '🚗', title: 'Brake Service', desc: 'Inspection, repair, and replacement' }
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % services.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + services.length) % services.length);
  };

  return (
    <main className="page home-page">
      {/* Services Overview */}
      <section className="services-preview">
        <h2>Our Services</h2>

        {/* Desktop Grid */}
        <div className="services-grid desktop-only">
          {services.map((service, index) => (
            <div key={index} className="service-card">
              <div className="service-icon">{service.icon}</div>
              <h3>{service.title}</h3>
              <p>{service.desc}</p>
            </div>
          ))}
        </div>

        {/* Mobile Carousel */}
        <div className="services-carousel mobile-only">
          <button className="carousel-btn carousel-prev" onClick={prevSlide} aria-label="Previous">
            ‹
          </button>
          <div className="carousel-container">
            <div className="carousel-track" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
              {services.map((service, index) => (
                <div key={index} className="service-card carousel-slide">
                  <div className="service-icon">{service.icon}</div>
                  <h3>{service.title}</h3>
                  <p>{service.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <button className="carousel-btn carousel-next" onClick={nextSlide} aria-label="Next">
            ›
          </button>
          <div className="carousel-dots">
            {services.map((_, index) => (
              <button
                key={index}
                className={`carousel-dot ${currentSlide === index ? 'active' : ''}`}
                onClick={() => setCurrentSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Google Calendar Integration */}
      <section className="calendar-section">
        <h5>Check our calendar to see available appointment slots</h5>
        <GoogleCalendar onSelectSlot={(time) => {
          console.log('Selected slot:', time);
        }} />
      </section>
    </main>
  );
};

// ============= CONTACT PAGE =============
const ContactPage = () => {
  const [expandedSections, setExpandedSections] = useState({
    contactInfo: false,
    socialMedia: false,
    contactForm: false
  });

  const [contactFormData, setContactFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setContactFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleContactSubmit = (e) => {
    e.preventDefault();

    // Build mailto link with form data
    const { name, email, phone, subject, message } = contactFormData;
    const recipientEmail = CONFIGURATION.contact.email;

    const emailBody = `Name: ${name}
Email: ${email}
Phone: ${phone || 'Not provided'}

Message:
${message}`;

    const mailtoLink = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;

    // Open default email client
    window.location.href = mailtoLink;
  };

  return (
    <main className="page contact-page">
      <div className="page-header">
        <h2>Contact Us</h2>
        <p>Get in touch with Old Reliable Automotive</p>
      </div>

      <div className="collapsible-container grid-two-column">
        <div className="collapsible-section">
          <button
            className="collapsible-header"
            onClick={() => toggleSection('contactInfo')}
            aria-expanded={expandedSections.contactInfo}
          >
            <h2>Get in Touch</h2>
            <span className="collapsible-toggle">{expandedSections.contactInfo ? '−' : '+'}</span>
          </button>
          {expandedSections.contactInfo && (
            <div className="collapsible-content contact-info">
              <div className="contact-method">
                <h3>📞 Phone</h3>
                <p><a href="tel:+15551234567">(555) 123-4567</a></p>
                <p className="note">Call us Monday-Friday, 8am-6pm | Saturday 9am-2pm</p>
              </div>
              <hr className="divider-line" />
              <div className="contact-method">
                <h3>✉️ Email</h3>
                <p><a href="mailto:oldreliablemotive@gmail.com">oldreliablemotive@gmail.com</a></p>
                <p className="note">We typically respond within 2 hours</p>
              </div>
              <hr className="divider-line" />
              <div className="contact-method">
                <h3>📍 Service Area</h3>
                <p>We provide mobile service throughout the Metro Atlanta area</p>
              </div>
            </div>
          )}
        </div>

        <div className="collapsible-section">
          <button
            className="collapsible-header"
            onClick={() => toggleSection('socialMedia')}
            aria-expanded={expandedSections.socialMedia}
          >
            <h2>Follow Us</h2>
            <span className="collapsible-toggle">{expandedSections.socialMedia ? '−' : '+'}</span>
          </button>
          {expandedSections.socialMedia && (
            <div className="collapsible-content social-media">
              <div className="social-links">
                <a href="https://instagram.com" className="social-link" target="_blank" rel="noopener noreferrer">
                  <span>📷</span> Instagram
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="collapsible-section">
        <button
          className="collapsible-header"
          onClick={() => toggleSection('contactForm')}
          aria-expanded={expandedSections.contactForm}
        >
          <h2>Send Us a Message</h2>
          <span className="collapsible-toggle">{expandedSections.contactForm ? '−' : '+'}</span>
        </button>
        {expandedSections.contactForm && (
          <div className="collapsible-content contact-form-section">
            <form className="contact-form" onSubmit={handleContactSubmit}>
              <div className="form-group">
                <label htmlFor="contact-name">Name</label>
                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  placeholder="Your name"
                  value={contactFormData.name}
                  onChange={handleContactChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="contact-email">Email</label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  placeholder="your@email.com"
                  value={contactFormData.email}
                  onChange={handleContactChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="contact-phone">Phone</label>
                <input
                  id="contact-phone"
                  name="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={contactFormData.phone}
                  onChange={handleContactChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="contact-subject">Subject</label>
                <input
                  id="contact-subject"
                  name="subject"
                  type="text"
                  placeholder="What is this about?"
                  value={contactFormData.subject}
                  onChange={handleContactChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="contact-message">Message</label>
                <textarea
                  id="contact-message"
                  name="message"
                  placeholder="Your message..."
                  rows="5"
                  value={contactFormData.message}
                  onChange={handleContactChange}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary">Send Message</button>
            </form>
          </div>
        )}
      </div>

      <section className="quick-booking">
        <h2>Quick Booking</h2>
        <p>Need an appointment? Use the Book Now link in the navigation to schedule your service.</p>
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
        <h2>FAQ & Testimonials</h2>
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
              <p className="testimonial-text">&ldquo;{testimonial.text}&rdquo;</p>
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

// ============= BOOK NOW PAGE =============
const BookNowPage = () => {
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

    // Build mailto link with form data
    const { name, email, phone, date, time, service, message } = formData;
    const recipientEmail = CONFIGURATION.contact.email;

    const emailBody = `APPOINTMENT REQUEST

Customer Information:
- Name: ${name}
- Email: ${email}
- Phone: ${phone}

Appointment Details:
- Preferred Date: ${date}
- Preferred Time: ${time}
- Service Type: ${service}

Additional Notes:
${message || 'None provided'}`;

    const subject = `Appointment Request from ${name} - ${service}`;
    const mailtoLink = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;

    // Open default email client
    window.location.href = mailtoLink;
  };

  return (
    <main className="page book-now-page">
      <div className="page-header">
        <h2>Book an Appointment</h2>
        <p>Schedule your service with Old Reliable Automotive</p>
      </div>

      <section className="booking-form-section">
        <form onSubmit={handleSubmit} className="appointment-form booking-form">
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

          <button type="submit" className="btn btn-primary btn-lg">
            Request Appointment
          </button>
        </form>
      </section>
    </main>
  );
};

// ============= DEFAULT SETTINGS =============
const getDefaultSettings = () => ({
  businessName: CONFIGURATION.header?.business_name || 'Old Reliable Automotive',
  tagline: CONFIGURATION.header?.tagline || 'Mobile Auto Repair & Maintenance',
  welcomeMessage: CONFIGURATION.header?.welcome_message || '',
  quoteMessage: CONFIGURATION.header?.quote_message || '',
  contact_name: CONFIGURATION.contact?.contact_name || '',
  phone: CONFIGURATION.contact?.phone || '',
  email: CONFIGURATION.contact?.email || '',
  serviceArea: CONFIGURATION.contact?.service_area || 'We provide mobile service throughout the Metro Atlanta area',
  showBusinessHours: true,
  hoursMonday: CONFIGURATION.footer?.hours?.monday || '8:00 AM - 6:00 PM',
  hoursTuesday: CONFIGURATION.footer?.hours?.tuesday || '8:00 AM - 6:00 PM',
  hoursWednesday: CONFIGURATION.footer?.hours?.wednesday || '8:00 AM - 6:00 PM',
  hoursThursday: CONFIGURATION.footer?.hours?.thursday || '8:00 AM - 6:00 PM',
  hoursFriday: CONFIGURATION.footer?.hours?.friday || '8:00 AM - 6:00 PM',
  hoursSaturday: CONFIGURATION.footer?.hours?.saturday || '9:00 AM - 4:00 PM',
  hoursSunday: CONFIGURATION.footer?.hours?.sunday || 'Closed',
  instagramUrl: '',
  disclaimer: CONFIGURATION.footer?.disclaimer || 'Services are performed at the customer\'s location. Please ensure a safe working environment for our technicians.',
  copyright: CONFIGURATION.footer?.copyright || '© 2026 Old Reliable Automotive. All rights reserved.',
  // Branding & Theme
  heroLogo: '/hero-logo-nobackground.png',
  colorRust: '#8b4513',
  colorGold: '#d4a574',
  colorCream: '#f5f1e8',
  colorDarkBrown: '#3e2723',
});

// ============= ADMIN PAGE =============
const AdminPage = ({ settings, setSettings, saveStatus, setSaveStatus, isLoading, isAuthenticated, setIsAuthenticated }) => {
  const defaultSettings = getDefaultSettings();
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [activeTab, setActiveTab] = useState('settings');
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [availableImages, setAvailableImages] = useState([]);

  // Fetch available images for logo selector
  useEffect(() => {
    if (isAuthenticated) {
      fetch('/api/images')
        .then(res => res.json())
        .then(data => setAvailableImages(data.images || []))
        .catch(err => console.error('Failed to fetch images:', err));
    }
  }, [isAuthenticated]);

  // Fetch analytics when tab changes to analytics
  useEffect(() => {
    if (activeTab === 'analytics' && isAuthenticated) {
      setAnalyticsLoading(true);
      fetch('/api/analytics')
        .then(res => res.json())
        .then(data => setAnalytics(data))
        .catch(err => console.error('Failed to fetch analytics:', err))
        .finally(() => setAnalyticsLoading(false));
    }
  }, [activeTab, isAuthenticated]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsAuthenticated(true);
        sessionStorage.setItem('orm_admin_auth', 'true');
      } else {
        setLoginError(data.error || 'Invalid credentials');
      }
    } catch (error) {
      setLoginError('Login failed. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };



  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
    setSaveStatus(''); // Clear save status when editing
  };

  const handleToggle = (name) => {
    setSettings(prev => ({ ...prev, [name]: !prev[name] }));
    setSaveStatus('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveStatus('Saving...');

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        // Also save to localStorage as backup
        localStorage.setItem('orm_admin_settings', JSON.stringify(settings));
        setSaveStatus('Settings saved successfully!');
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        const data = await response.json();
        setSaveStatus(`Error: ${data.error || 'Failed to save settings'}`);
      }
    } catch (error) {
      console.error('Save error:', error);
      // Fall back to localStorage only
      localStorage.setItem('orm_admin_settings', JSON.stringify(settings));
      setSaveStatus('Saved locally (server unavailable)');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'orm_settings.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          setSettings(imported);
          localStorage.setItem('orm_admin_settings', JSON.stringify(imported));
          setSaveStatus('Settings imported successfully!');
        } catch {
          setSaveStatus('Error importing file. Please check the format.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults?')) {
      try {
        // Save defaults to API
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(defaultSettings),
        });
        localStorage.removeItem('orm_admin_settings');
        setSettings(defaultSettings);
        setSaveStatus('Settings reset to defaults.');
        setTimeout(() => setSaveStatus(''), 3000);
      } catch (error) {
        localStorage.removeItem('orm_admin_settings');
        setSettings(defaultSettings);
        setSaveStatus('Reset locally (server unavailable)');
        setTimeout(() => setSaveStatus(''), 3000);
      }
    }
  };

  if (isLoading) {
    return (
      <main className="page admin-page">
        <div className="page-header">
          <h2>Admin Settings</h2>
          <p>Loading settings...</p>
        </div>
      </main>
    );
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <main className="page admin-page">
        <div className="page-header">
          <h2>Admin Login</h2>
          <p>Please sign in to access admin settings</p>
        </div>

        <form onSubmit={handleLogin} className="admin-form appointment-form admin-login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              value={credentials.username}
              onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
              required
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
              required
              autoComplete="current-password"
            />
          </div>
          {loginError && (
            <div className="save-status error">{loginError}</div>
          )}
          <button type="submit" className="btn btn-primary" disabled={loginLoading}>
            {loginLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </main>
    );
  }

  // Analytics display component
  const renderAnalytics = () => {
    if (analyticsLoading) {
      return <p>Loading analytics...</p>;
    }

    if (!analytics || !analytics.pages || Object.keys(analytics.pages).length === 0) {
      return (
        <div className="admin-notice">
          <p>No analytics data yet. Page visits will be tracked as users browse the site.</p>
        </div>
      );
    }

    const pageNames = {
      home: 'Home',
      contact: 'Contact',
      faq: 'FAQ & Testimonials',
      book: 'Book Now'
    };

    return (
      <div className="analytics-content">
        <div className="analytics-summary">
          <div className="analytics-card">
            <span className="analytics-number">{analytics.totalVisits || 0}</span>
            <span className="analytics-label">Total Page Views</span>
          </div>
        </div>

        <section className="admin-section">
          <h3>Page Views</h3>
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Total Views</th>
                <th>Today</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(analytics.pages).map(([page, data]) => {
                const today = new Date().toISOString().split('T')[0];
                const todayViews = data.daily?.[today] || 0;
                return (
                  <tr key={page}>
                    <td>{pageNames[page] || page}</td>
                    <td>{data.total || 0}</td>
                    <td>{todayViews}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    );
  };

  return (
    <main className="page admin-page">
      <div className="page-header">
        <h2>Admin Dashboard</h2>
        <p>Manage your website configuration and view analytics</p>

      </div>

      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Site Settings
        </button>
        <button
          className={`admin-tab ${activeTab === 'branding' ? 'active' : ''}`}
          onClick={() => setActiveTab('branding')}
        >
          Branding
        </button>
        <button
          className={`admin-tab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          Site Analytics
        </button>
      </div>

      {activeTab === 'analytics' ? (
        renderAnalytics()
      ) : activeTab === 'branding' ? (
        <div className="admin-form">
          <section className="admin-section">
            <h3>Logo</h3>
            <div className="form-group">
              <label htmlFor="heroLogo">Hero Logo</label>
              <select
                id="heroLogo"
                name="heroLogo"
                value={settings.heroLogo || ''}
                onChange={handleChange}
              >
                <option value="">Select a logo</option>
                {availableImages.map(img => (
                  <option key={img} value={img}>{img}</option>
                ))}
              </select>
            </div>
            {settings.heroLogo && (
              <div className="logo-preview">
                <p>Preview:</p>
                <img src={settings.heroLogo} alt="Logo preview" style={{ maxWidth: '200px', maxHeight: '100px' }} />
              </div>
            )}
          </section>

          <section className="admin-section">
            <h3>Theme Colors</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="colorRust">Primary (Rust)</label>
                <div className="color-input-wrapper">
                  <input
                    id="colorRust"
                    name="colorRust"
                    type="color"
                    value={settings.colorRust || '#8b4513'}
                    onChange={handleChange}
                  />
                  <input
                    type="text"
                    value={settings.colorRust || '#8b4513'}
                    onChange={(e) => handleChange({ target: { name: 'colorRust', value: e.target.value } })}
                    placeholder="#8b4513"
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="colorGold">Accent (Gold)</label>
                <div className="color-input-wrapper">
                  <input
                    id="colorGold"
                    name="colorGold"
                    type="color"
                    value={settings.colorGold || '#d4a574'}
                    onChange={handleChange}
                  />
                  <input
                    type="text"
                    value={settings.colorGold || '#d4a574'}
                    onChange={(e) => handleChange({ target: { name: 'colorGold', value: e.target.value } })}
                    placeholder="#d4a574"
                  />
                </div>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="colorCream">Background (Cream)</label>
                <div className="color-input-wrapper">
                  <input
                    id="colorCream"
                    name="colorCream"
                    type="color"
                    value={settings.colorCream || '#f5f1e8'}
                    onChange={handleChange}
                  />
                  <input
                    type="text"
                    value={settings.colorCream || '#f5f1e8'}
                    onChange={(e) => handleChange({ target: { name: 'colorCream', value: e.target.value } })}
                    placeholder="#f5f1e8"
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="colorDarkBrown">Dark (Brown)</label>
                <div className="color-input-wrapper">
                  <input
                    id="colorDarkBrown"
                    name="colorDarkBrown"
                    type="color"
                    value={settings.colorDarkBrown || '#3e2723'}
                    onChange={handleChange}
                  />
                  <input
                    type="text"
                    value={settings.colorDarkBrown || '#3e2723'}
                    onChange={(e) => handleChange({ target: { name: 'colorDarkBrown', value: e.target.value } })}
                    placeholder="#3e2723"
                  />
                </div>
              </div>
            </div>
          </section>

          <div className="admin-actions">
            <button type="button" className="btn btn-primary" onClick={handleSave}>Save Branding</button>
          </div>
          {saveStatus && (
            <div className={`save-status ${saveStatus.includes('Error') ? 'error' : 'success'}`}>
              {saveStatus}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="admin-notice">
            <p><strong>Note:</strong> Settings are stored in Upstash Redis and sync across all devices. Changes take effect immediately.</p>
          </div>

          <form onSubmit={handleSave} className="admin-form appointment-form">
            <section className="admin-section">
              <h3>Business Information</h3>
              <div className="form-group">
                <label htmlFor="businessName">Business Name</label>
                <input
                  id="businessName"
                  name="businessName"
                  type="text"
                  value={settings.businessName}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="tagline">Tagline</label>
                <input
                  id="tagline"
                  name="tagline"
                  type="text"
                  value={settings.tagline}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="welcomeMessage">Welcome Message</label>
                <textarea
                  id="welcomeMessage"
                  name="welcomeMessage"
                  value={settings.welcomeMessage}
                  onChange={handleChange}
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label htmlFor="quoteMessage">Quote Message</label>
                <input
                  id="quoteMessage"
                  name="quoteMessage"
                  type="text"
                  value={settings.quoteMessage}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="serviceArea">Service Area Description</label>
                <input
                  id="serviceArea"
                  name="serviceArea"
                  type="text"
                  value={settings.serviceArea}
                  onChange={handleChange}
                />
              </div>
            </section>

            <section className="admin-section">
              <h3>Contact Information</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="contact_name">Contact Name</label>
                  <input
                    id="contact_name"
                    name="contact_name"
                    type="text"
                    value={settings.contact_name}
                    onChange={handleChange}
                    placeholder="Enter contact name"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="phone">Phone Number</label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={settings.phone}
                    onChange={handleChange}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={settings.email}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </section>

            <section className="admin-section">
              <h3>Business Hours</h3>
              <div className="toggle-container">
                <span className="toggle-label">Show Business Hours</span>
                <button
                  type="button"
                  onClick={() => handleToggle('showBusinessHours')}
                  className={`toggle-switch ${settings.showBusinessHours ? 'active' : ''}`}
                  aria-pressed={settings.showBusinessHours}
                >
                  <span className="toggle-slider" />
                </button>
                <span className="toggle-status">{settings.showBusinessHours ? 'On' : 'Off'}</span>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="hoursMonday">Monday</label>
                  <input
                    id="hoursMonday"
                    name="hoursMonday"
                    type="text"
                    value={settings.hoursMonday}
                    onChange={handleChange}
                    readOnly={!settings.showBusinessHours}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="hoursTuesday">Tuesday</label>
                  <input
                    id="hoursTuesday"
                    name="hoursTuesday"
                    type="text"
                    value={settings.hoursTuesday}
                    onChange={handleChange}
                    readOnly={!settings.showBusinessHours}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="hoursWednesday">Wednesday</label>
                  <input
                    id="hoursWednesday"
                    name="hoursWednesday"
                    type="text"
                    value={settings.hoursWednesday}
                    onChange={handleChange}
                    readOnly={!settings.showBusinessHours}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="hoursThursday">Thursday</label>
                  <input
                    id="hoursThursday"
                    name="hoursThursday"
                    type="text"
                    value={settings.hoursThursday}
                    onChange={handleChange}
                    readOnly={!settings.showBusinessHours}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="hoursFriday">Friday</label>
                  <input
                    id="hoursFriday"
                    name="hoursFriday"
                    type="text"
                    value={settings.hoursFriday}
                    onChange={handleChange}
                    readOnly={!settings.showBusinessHours}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="hoursSaturday">Saturday</label>
                  <input
                    id="hoursSaturday"
                    name="hoursSaturday"
                    type="text"
                    value={settings.hoursSaturday}
                    onChange={handleChange}
                    readOnly={!settings.showBusinessHours}
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="hoursSunday">Sunday</label>
                <input
                  id="hoursSunday"
                  name="hoursSunday"
                  type="text"
                  value={settings.hoursSunday}
                  onChange={handleChange}
                  readOnly={!settings.showBusinessHours}
                />
              </div>
            </section>

            <section className="admin-section">
              <h3>Social Media</h3>
              <div className="form-group">
                <label htmlFor="instagramUrl">Instagram URL</label>
                <input
                  id="instagramUrl"
                  name="instagramUrl"
                  type="url"
                  value={settings.instagramUrl}
                  onChange={handleChange}
                  placeholder="https://instagram.com/yourpage"
                />
              </div>
            </section>

            <section className="admin-section">
              <h3>Footer</h3>
              <div className="form-group">
                <label htmlFor="disclaimer">Disclaimer Text</label>
                <textarea
                  id="disclaimer"
                  name="disclaimer"
                  value={settings.disclaimer}
                  onChange={handleChange}
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label htmlFor="copyright">Copyright Text</label>
                <input
                  id="copyright"
                  name="copyright"
                  type="text"
                  value={settings.copyright}
                  onChange={handleChange}
                />
              </div>
            </section>

            {saveStatus && (
              <div className={`save-status ${saveStatus.includes('Error') ? 'error' : 'success'}`}>
                {saveStatus}
              </div>
            )}

            <div className="admin-actions">
              <button type="submit" className="btn btn-primary">Save Settings</button>
              {/*
          <button type="button" className="btn" onClick={handleExport}>Export to JSON</button>
          <label className="btn btn-import">
            Import JSON
            <input type="file" accept=".json" onChange={handleImport} hidden />
          </label>
          <button type="button" className="btn btn-reset" onClick={handleReset}>Reset to Defaults</button>
          */}
            </div>
          </form>
        </>
      )}
    </main>
  );
};

// ============= NAVIGATION =============
const Navigation = ({ currentPage, onPageChange, isCollapsed, onToggleCollapse, settings, adminModeEnabled, isAuthenticated, onLogout }) => {
  const footerConfig = CONFIGURATION.footer;
  const contactConfig = CONFIGURATION.contact;
  const showBusinessHours = settings?.showBusinessHours !== false;
  const [showInfoPopover, setShowInfoPopover] = useState(false);

  return (
    <nav className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="nav-logo">
          <span className="logo-icon">⚙️</span>
          {!isCollapsed && <span className="logo-text">{CONFIGURATION.header.tagline}</span>}
        </div>
        <button className="sidebar-toggle" onClick={onToggleCollapse} aria-label="Toggle sidebar">
          {isCollapsed ? '»' : '«'}
        </button>
      </div>
      <ul className="nav-menu">
        <li>
          <button
            className={`nav-link ${currentPage === 'home' ? 'active' : ''}`}
            onClick={() => onPageChange('home')}
            title="Home"
          >
            <span className="nav-icon">🏠</span>
            {!isCollapsed && <span className="nav-text">Home</span>}
          </button>
        </li>
        <li>
          <button
            className={`nav-link ${currentPage === 'contact' ? 'active' : ''}`}
            onClick={() => onPageChange('contact')}
            title="Contact"
          >
            <span className="nav-icon">📞</span>
            {!isCollapsed && <span className="nav-text">Contact</span>}
          </button>
        </li>
        <li>
          <button
            className={`nav-link ${currentPage === 'faq' ? 'active' : ''}`}
            onClick={() => onPageChange('faq')}
            title="FAQ"
          >
            <span className="nav-icon">❓</span>
            {!isCollapsed && <span className="nav-text">FAQ</span>}
          </button>
        </li>
        <li>
          <button
            className={`nav-link nav-book-btn ${currentPage === 'book' ? 'active' : ''}`}
            onClick={() => onPageChange('book')}
            title="Book an Appointment"
          >
            <span className="nav-icon">📅</span>
            {!isCollapsed && <span className="nav-text">Book Now</span>}
          </button>
        </li>
        {adminModeEnabled && (
          <li>
            <button
              className={`nav-link ${currentPage === 'admin' ? 'active' : ''}`}
              onClick={() => onPageChange('admin')}
              title="Admin Settings"
            >
              <span className="nav-icon">⚙️</span>
              {!isCollapsed && <span className="nav-text">Admin</span>}
            </button>
          </li>
        )}
      </ul>

      {/* Mobile Info Button - only visible on mobile */}
      <div className="mobile-info-container">
        <button
          className="mobile-info-btn"
          onClick={() => setShowInfoPopover(!showInfoPopover)}
          aria-label="Show hours and contact info"
          title="Hours & Contact"
        >
          <span className="nav-icon">🕐</span>
        </button>
        {showInfoPopover && (
          <div className="mobile-info-popover">
            <button
              className="popover-close"
              onClick={() => setShowInfoPopover(false)}
              aria-label="Close"
            >
              ✕
            </button>
            {showBusinessHours && (
              <div className="popover-section">
                <span className="popover-title">Hours</span>
                <span>Mon-Fri: {settings?.hoursMonday || footerConfig.hours.monday}</span>
                <span>Sat: {settings?.hoursSaturday || footerConfig.hours.saturday}</span>
                <span>Sun: {settings?.hoursSunday || footerConfig.hours.sunday}</span>
              </div>
            )}
            <div className="popover-section">
              <span className="popover-title">Contact</span>
              <span><a href={`tel:${contactConfig.phone}`}>{contactConfig.phone}</a></span>
              <span><a href={`mailto:${contactConfig.email}`}>{contactConfig.email}</a></span>
            </div>
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div className="nav-footer">
          <ul className="nav-bottom">
            {showBusinessHours && (
              <li className="nav-bottom-section">
                <span className="nav-bottom-title">Hours</span>
                <span>Mon-Fri: {settings?.hoursMonday || footerConfig.hours.monday}</span>
                <span>Sat: {settings?.hoursSaturday || footerConfig.hours.saturday}</span>
                <span>Sun: {settings?.hoursSunday || footerConfig.hours.sunday}</span>
              </li>
            )}
            <li className="nav-bottom-section">
              <span className="nav-bottom-title">Contact</span>
              <span><a href={`tel:${contactConfig.phone}`}>{contactConfig.phone}</a></span>
              <span><a href={`mailto:${contactConfig.email}`}>{contactConfig.email}</a></span>
            </li>
            {adminModeEnabled && isAuthenticated && (
              <li>
                <button onClick={onLogout} className="btn btn-logout">Logout</button>
              </li>
            )}
          </ul>
        </div>
      )}
    </nav>
  );
};

// ============= FOOTER =============
const Footer = () => {
  return (
    <footer >
      <div className="footer-bottom">
        <p>{CONFIGURATION.footer.disclaimer}</p>
        <p>{CONFIGURATION.footer.copyright}</p>
      </div>
    </footer>
  );
};

// ============= MAIN APP =============
export default function ORMWebpage() {
  const [currentPage, setCurrentPage] = useState('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [adminModeEnabled, setAdminModeEnabled] = useState(false);

  // Lifted settings state for sharing between AdminPage and Navigation
  const [settings, setSettings] = useState(getDefaultSettings());
  const [saveStatus, setSaveStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Lifted auth state for sharing between AdminPage and Navigation
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('orm_admin_auth') === 'true';
    }
    return false;
  });

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('orm_admin_auth');
    //setCurrentPage('home');
    const hostname = window.location.hostname;
    console.log('Hostname on logout:', hostname);
    const cleanURL = window.location.origin + window.location.pathname;
    if (hostname.indexOf("localhost") !== -1) {
      window.location.replace(cleanURL);
    }
    else {
      window.location.replace(CONFIGURATION.header.homepage_url);
    }

  };

  // Check for admin_mode_enabled URL param on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('admin_mode_enabled')) {
      setAdminModeEnabled(true);
      setCurrentPage('admin');
      // Store in session so it persists during navigation
      sessionStorage.setItem('orm_admin_mode', 'true');
    } else if (sessionStorage.getItem('orm_admin_mode') === 'true') {
      setAdminModeEnabled(true);
    }
  }, []);

  // Track page visits (except admin page)
  useEffect(() => {
    if (currentPage && currentPage !== 'admin') {
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: currentPage }),
      }).catch(err => console.error('Analytics error:', err));
    }
  }, [currentPage]);

  // Fetch settings from API on mount
  useEffect(() => {
    const fetchSettings = async () => {
      const defaultSettings = getDefaultSettings();
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const data = await response.json();
          if (data && Object.keys(data).length > 0) {
            setSettings({ ...defaultSettings, ...data });
          }
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
        // Fall back to localStorage if API fails
        const saved = localStorage.getItem('orm_admin_settings');
        if (saved) {
          setSettings({ ...defaultSettings, ...JSON.parse(saved) });
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage />;
      case 'contact':
        return <ContactPage />;
      case 'faq':
        return <FAQTestimoniesPage />;
      case 'book':
        return <BookNowPage />;
      case 'admin':
        return <AdminPage settings={settings} setSettings={setSettings} saveStatus={saveStatus} setSaveStatus={setSaveStatus} isLoading={isLoading} isAuthenticated={isAuthenticated} setIsAuthenticated={setIsAuthenticated} />;
      default:
        return <HomePage />;
    }
  };

  // Apply theme colors as CSS custom properties
  const themeStyles = {
    '--rust': settings.colorRust || '#8b4513',
    '--gold': settings.colorGold || '#d4a574',
    '--cream': settings.colorCream || '#f5f1e8',
    '--dark-brown': settings.colorDarkBrown || '#3e2723',
    '--light-gold': settings.colorGold ? `${settings.colorGold}40` : '#e8d5b7',
  };

  return (
    <div className={`app ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`} style={themeStyles}>
      <Navigation
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        settings={settings}
        adminModeEnabled={adminModeEnabled}
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
      />
      <div className="main-content">
        <HeroHeader settings={settings} />
        {renderPage()}
        <Footer />
      </div>
    </div>
  );
}
