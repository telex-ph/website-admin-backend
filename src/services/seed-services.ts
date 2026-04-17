import Service from './Service.js';

const initialServices = [
  {
    serviceId: 'ai-builder',
    name: 'AI Builder',
    description: 'Build intelligent AI-powered solutions tailored to your business needs. Automate workflows and enhance decision-making with cutting-edge AI tools.',
    badge: 'AI & Tech',
    isActive: true,
  },
  {
    serviceId: 'automation',
    name: 'Automation',
    description: 'Streamline repetitive tasks and business processes with smart automation. Increase efficiency, reduce errors, and free up your team for high-value work.',
    badge: 'Operations',
    isActive: true,
  },
  {
    serviceId: 'booking-appointment',
    name: 'Booking & Appointment',
    description: 'Manage scheduling with ease. Our booking systems handle client appointments, reminders, and calendar integrations seamlessly.',
    badge: 'Scheduling',
    isActive: true,
  },
  {
    serviceId: 'courses-produ.js',
    name: 'Courses / Produ.js',
    description: 'Launch and manage online courses, digital products, and e-learning platforms. Monetize your expertise with robust product delivery systems.',
    badge: 'Education',
    isActive: true,
  },
  {
    serviceId: 'crm',
    name: 'CRM',
    description: 'Centralize customer relationships with a powerful CRM system. Track leads, nurture clients, and drive sales growth with data-driven insights.',
    badge: 'Sales',
    isActive: true,
  },
  {
    serviceId: 'csr',
    name: 'CSR',
    description: 'Deliver exceptional customer support through trained representatives. Resolve issues efficiently and build lasting customer loyalty.',
    badge: 'Support',
    isActive: true,
  },
  {
    serviceId: 'email-marketing',
    name: 'Email Marketing',
    description: 'Design, automate, and optimize email campaigns that convert. Grow your subscriber list and engage audiences with personalized messaging.',
    badge: 'Marketing',
    isActive: true,
  },
  {
    serviceId: 'funnel-builder',
    name: 'Funnel Builder',
    description: 'Build high-converting sales funnels from scratch. Guide prospects through every stage of the buyer journey with strategic landing pages and flows.',
    badge: 'Sales',
    isActive: true,
  },
  {
    serviceId: 'gray-label',
    name: 'Gray Label',
    description: 'Offer branded service solutions under a shared identity. Perfect for agencies looking to expand offerings without building from scratch.',
    badge: 'Branding',
    isActive: true,
  },
  {
    serviceId: 'social-media-management',
    name: 'Social Media Management',
    description: 'Grow your brand presence across all social platforms. From content creation to scheduling and analytics, we handle it all.',
    badge: 'Marketing',
    isActive: true,
  },
  {
    serviceId: 'survey-forms',
    name: 'Survey and Forms',
    description: 'Collect meaningful data with custom surveys and forms. Analyze responses in real-time and make informed business decisions.',
    badge: 'Data',
    isActive: true,
  },
  {
    serviceId: 'tech-support',
    name: 'Tech Support',
    description: 'Provide reliable technical assistance to your clients around the clock. From troubleshooting to maintenance, our tech team has it covered.',
    badge: 'Support',
    isActive: true,
  },
  {
    serviceId: 'web-development',
    name: 'Web Development',
    description: 'Create stunning, responsive websites that drive results. From simple landing pages to complex web applications, we build it all.',
    badge: 'Development',
    isActive: true,
  },
];

export async function seedServices() {
  try {
    // Check if services already exist
    const existingCount = await Service.countDocuments();
    
    if (existingCount > 0) {
      console.log('Services already exist in database. Skipping seed.');
      return;
    }

    // Insert all services
    await Service.insertMany(initialServices);
    console.log(`✅ Successfully seeded ${initialServices.length} services!`);
  } catch (error) {
    console.error('❌ Error seeding services:', error);
    throw error;
  }
}

// Run seed if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Connect to your database first, then:
  seedServices()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
