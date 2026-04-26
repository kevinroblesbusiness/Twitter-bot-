import { Router, Request, Response } from 'express';
import {
  getFanDetails,
  getOrCreateFanDetails,
  updateFanDetails,
  buildFanContext,
  createFanRequest,
  getFanRequests,
  updateRequestStatus,
  getCreatorPendingRequests,
} from '../services/fan-service.js';

export function setupFanDetailsRoutes(): Router {
  const router = Router();

  // Get fan details
  router.get('/:fanId/details', async (req: Request, res: Response) => {
    try {
      const { fanId } = req.params;
      const details = await getFanDetails(fanId);

      if (!details) {
        return res.status(404).json({ error: 'Fan details not found' });
      }

      res.json(details);
    } catch (error) {
      console.error('Error fetching fan details:', error);
      res.status(500).json({ error: 'Failed to fetch fan details' });
    }
  });

  // Update fan details
  router.put('/:fanId/details', async (req: Request, res: Response) => {
    try {
      const { fanId } = req.params;
      const updates = req.body;

      const details = await updateFanDetails(fanId, updates);

      if (!details) {
        return res.status(404).json({ error: 'Fan details not found' });
      }

      res.json(details);
    } catch (error) {
      console.error('Error updating fan details:', error);
      res.status(500).json({ error: 'Failed to update fan details' });
    }
  });

  // Get fan context for Claude (summarized)
  router.get('/:fanId/context', async (req: Request, res: Response) => {
    try {
      const { fanId } = req.params;
      const context = await buildFanContext(fanId);

      res.json({ context });
    } catch (error) {
      console.error('Error building fan context:', error);
      res.status(500).json({ error: 'Failed to build fan context' });
    }
  });

  // Get fan requests
  router.get('/:fanId/requests', async (req: Request, res: Response) => {
    try {
      const { fanId } = req.params;
      const { status } = req.query;

      const requests = await getFanRequests(fanId, status as string);

      res.json(requests);
    } catch (error) {
      console.error('Error fetching fan requests:', error);
      res.status(500).json({ error: 'Failed to fetch fan requests' });
    }
  });

  // Create a fan request
  router.post('/:fanId/requests', async (req: Request, res: Response) => {
    try {
      const { fanId } = req.params;
      const { creatorId, requestText, requestType } = req.body;

      if (!creatorId || !requestText) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const request = await createFanRequest(
        fanId,
        creatorId,
        requestText,
        requestType
      );

      res.status(201).json(request);
    } catch (error) {
      console.error('Error creating fan request:', error);
      res.status(500).json({ error: 'Failed to create fan request' });
    }
  });

  // Update request status
  router.patch('/requests/:requestId', async (req: Request, res: Response) => {
    try {
      const { requestId } = req.params;
      const { status, contentId, fulfilledDate } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }

      const updated = await updateRequestStatus(
        requestId,
        status,
        contentId,
        fulfilledDate
      );

      if (!updated) {
        return res.status(404).json({ error: 'Request not found' });
      }

      res.json(updated);
    } catch (error) {
      console.error('Error updating request status:', error);
      res.status(500).json({ error: 'Failed to update request status' });
    }
  });

  // Get all pending requests for creator
  router.get('/creator/:creatorId/pending-requests', async (req: Request, res: Response) => {
    try {
      const { creatorId } = req.params;
      const requests = await getCreatorPendingRequests(creatorId);

      res.json(requests);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      res.status(500).json({ error: 'Failed to fetch pending requests' });
    }
  });

  return router;
}
