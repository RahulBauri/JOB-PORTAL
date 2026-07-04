import axios from 'axios';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import getBuffer from '../utils/buffer.js';
import { sql } from '../utils/db.js';
import ErrorHandler from '../utils/errorHandler.js';
import { TryCath } from '../utils/TryCatch.js';
import { applicationStatusUpdateTemplate } from '../tempalate.js';
import { publishToTopic } from '../producer.js';

export const createCompany = TryCath(
  async (req: AuthenticatedRequest, res, next) => {
    const user = req.user;

    if (user?.role !== 'recruiter') {
      return next(
        new ErrorHandler(403, 'Forbidden: Only recruiter can create a company'),
      );
    }

    const { name, description, website } = req.body;

    if (!name || !description || !website) {
      return next(new ErrorHandler(400, 'All the fields are required'));
    }

    const existingCompany = await sql`
    SELECT company_id FROM companies
    WHERE name = ${name}
  `;

    if (existingCompany.length > 0) {
      return next(
        new ErrorHandler(409, `A company with the name ${name} already exists`),
      );
    }

    const file = req.file;

    if (!file) {
      return next(new ErrorHandler(400, 'Company logo file is required'));
    }

    const fileBuffer = getBuffer(file);

    if (!fileBuffer || !fileBuffer.content) {
      return next(new ErrorHandler(500, 'Failed to create file buffer'));
    }

    const { data } = await axios.post(
      `${process.env.UPLOAD_SERVICE}/api/utils/upload`,
      {
        buffer: fileBuffer.content,
      },
    );

    const [newCompany] = await sql`
      INSERT INTO companies (name, description, website, logo, logo_public_id, recruiter_id)
      VALUES (${name}, ${description}, ${website}, ${data.url}, ${data.public_id}, ${user.user_id})
      RETURNING *
    `;

    res.json({ message: 'Company created successfully', company: newCompany });
  },
);

export const deleteCompany = TryCath(
  async (req: AuthenticatedRequest, res, next) => {
    const user = req.user;

    const { companyId } = req.params;

    const [company] = await sql`
    SELECT logo_public_id FROM companies
    WHERE company_id = ${companyId}
    AND recruiter_id = ${user?.user_id}
  `;

    if (!company) {
      return next(
        new ErrorHandler(
          404,
          "Company not found or you're not authorized to delete it.",
        ),
      );
    }

    await sql`
    DELETE FROM companies WHERE company_id = ${companyId}
  `;

    res.json({
      message: 'Company and all associated jobs have been deleted',
    });
  },
);

export const createJob = TryCath(
  async (req: AuthenticatedRequest, res, next) => {
    const user = req.user;

    if (user?.role !== 'recruiter') {
      return next(
        new ErrorHandler(403, 'Forbidden: Only recruiter can create a job'),
      );
    }

    const {
      title,
      description,
      salary,
      location,
      role,
      job_type,
      work_location,
      company_id,
      openings,
    } = req.body;

    if (!title || !description || !salary || !location || !role || !openings) {
      return next(new ErrorHandler(400, 'All the fields are required'));
    }

    const [company] = await sql`
      SELECT company_id FROM companies WHERE company_id = ${company_id}
      AND recruiter_id = ${user?.user_id}
    `;

    if (!company) {
      return next(new ErrorHandler(404, 'Company not found'));
    }

    const [newJob] = await sql`
      INSERT INTO jobs (title, description, salary, location, role, job_type, work_location, company_id, posted_by_recruiter_id, openings)
      VALUES (${title}, ${description}, ${salary}, ${location}, ${role}, ${job_type}, ${work_location}, ${company_id}, ${user?.user_id}, ${openings})
      RETURNING *
    `;

    res.json({ message: 'Job posted successfully', job: newJob });
  },
);

export const updateJob = TryCath(
  async (req: AuthenticatedRequest, res, next) => {
    const user = req.user;

    if (user?.role !== 'recruiter') {
      return next(
        new ErrorHandler(403, 'Forbidden: Only recruiter can create a job'),
      );
    }

    const {
      title,
      description,
      salary,
      location,
      role,
      job_type,
      work_location,
      openings,
      is_active,
    } = req.body;

    const [existingJob] = await sql`
    SELECT posted_by_recruiter_id FROM jobs WHERE job_id = ${req.params.jobId}
  `;

    if (!existingJob) {
      return next(new ErrorHandler(404, 'Job not found'));
    }

    if (existingJob.posted_by_recruiter_id !== user.user_id) {
      return next(new ErrorHandler(403, 'Forbidden: You are not allowed'));
    }

    const updatedJob = await sql`
      UPDATE jobs SET 
        title = ${title}, 
        description = ${description}, 
        salary = ${salary}, 
        location = ${location}, 
        role = ${role}, 
        job_type = ${job_type}, 
        work_location = ${work_location}, 
        openings = ${openings}, 
        is_active = ${is_active}
        WHERE job_id = ${req.params.jobId}
      RETURNING *
`;

    res.json({ message: 'Job updated successfully', job: updatedJob });
  },
);

export const getAllCompany = TryCath(
  async (req: AuthenticatedRequest, res, next) => {
    const user = req.user;

    const companies = await sql`
      SELECT * FROM companies WHERE recruiter_id = ${user?.user_id}
    `;

    res.json(companies);
  },
);

export const getCompanyDetails = TryCath(
  async (req: AuthenticatedRequest, res, next) => {
    const { id } = req.params;

    if (!id) {
      return next(new ErrorHandler(400, 'Company id is required'));
    }

    const [companyData] = await sql`
      SELECT c.*, COALESCE (
        (SELECT json_agg(j.*) FROM jobs j WHERE j.company_id = c.company_id),
        '[]'::json) 
        AS jobs FROM companies c WHERE c.company_id = ${id} GROUP BY c.company_id
    `;

    if (!companyData) {
      return next(new ErrorHandler(404, 'Company not found'));
    }

    res.json(companyData);
  },
);

export const getAllActiveJobs = TryCath(async (req, res, next) => {
  const { title, location } = req.query as {
    title?: string;
    location?: string;
  };

  let queryString = `SELECT j.job_id, j.title, j.description, j.salary, j.location, j.job_type, j.role, j.work_location, j.created_at, c.name AS company_name, c.logo AS company_logo, c.company_id AS company_id FROM jobs j JOIN companies c ON j.company_id = c.company_id WHERE j.is_active = true`;

  const values = [];

  let paramIndex = 1;

  if (title) {
    queryString += ` AND j.title ILIKE $${paramIndex}`;
    values.push(`%${title}%`);
    paramIndex++;
  }
  if (location) {
    queryString += ` AND j.location ILIKE $${paramIndex}`;
    values.push(`%${location}%`);
    paramIndex++;
  }

  queryString += ' ORDER BY j.created_at DESC';

  const jobs = (await sql.query(queryString, values)) as any[];

  res.json(jobs);
});

export const getSingleJob = TryCath(async (req, res, next) => {
  const [job] = await sql`
    SELECT * FROM jobs WHERE job_id = ${req.params.jobId}
  `;

  res.json(job);
});

export const getAllApplicationForJob = TryCath(
  async (req: AuthenticatedRequest, res, next) => {
    const user = req.user;

    if (user?.role !== 'recruiter') {
      return next(
        new ErrorHandler(
          403,
          'Forbidden: Only a recruiter can access this api',
        ),
      );
    }

    const { jobId } = req.params;

    const [job] = await sql`
      SELECT posted_by_recruiter_id FROM jobs WHERE job_id = ${jobId}
    `;

    if (!job) {
      return next(new ErrorHandler(404, 'Job not found'));
    }

    if (job.posted_by_recruiter_id !== user.user_id) {
      return next(new ErrorHandler(403, 'Forbidden: You are not allowed'));
    }

    const applications = await sql`
      SELECT * FROM applications WHERE job_id = ${jobId} ORDER BY subscribed DESC, applied_at ASC
    `;

    res.json(applications);
  },
);

export const updateApplication = TryCath(
  async (req: AuthenticatedRequest, res, next) => {
    const user = req.user;

    if (user?.role !== 'recruiter') {
      return next(
        new ErrorHandler(
          403,
          'Forbidden: Only a recruiter can access this api',
        ),
      );
    }

    const { id } = req.params;

    const [application] = await sql`
    SELECT * FROM applications WHERE applicant_id = ${id}
   `;
    if (!application) {
      return next(new ErrorHandler(404, 'Application not found'));
    }

    const [job] = await sql`
    SELECT posted_by_recruiter_id, title FROM jobs WHERE job_id = ${application.job_id}
   `;

    if (!job) {
      return next(new ErrorHandler(404, 'no job with this id'));
    }

    if (job.posted_by_recruiter_id !== user.user_id) {
      return next(new ErrorHandler(403, 'Forbidden: you are not allowed'));
    }

    const [updatedApplication] = await sql`
    UPDATE applications SET status = ${req.body.status} WHERE applicant_id = ${id} RETURNING *
   `;
    const message = {
      to: application.applicant_email,
      subject: 'Application update - HireHeaven',
      html: applicationStatusUpdateTemplate(job.title),
    };

    await publishToTopic('send-mail', message).catch((error) => {
      console.error('failed to publish message to kafka', error);
    });

    res.json({ message: 'Application updated', job, updatedApplication });
  },
);
