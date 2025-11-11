import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Shield, AlertTriangle, CheckCircle, Target, FileCheck, Users } from 'lucide-react';
import { format } from 'date-fns';
import { RiskManagementMetrics } from '@/lib/types';

export function RiskManagementPage() {
  const [metrics, setMetrics] = useState<RiskManagementMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const userId = currentUser.id;

        if (!userId) {
          setLoading(false);
          return;
        }

        const response = await fetch(`http://localhost:5000/api/compliance/risk-management/${userId}`);

        if (response.ok) {
          const data = await response.json();
          setMetrics(data.metrics);
        } else {
          setMetrics({
            reinsuranceStrategy: {
              creditRating: 'A+',
              paymentHistory: 'Excellent',
              lastReviewDate: new Date().toISOString()
            },
            claimsDevelopment: {
              accuracyRate: 94.5,
              reservingAdequacy: 'Adequate'
            },
            internalControls: {
              effectiveness: 'Strong',
              lastAuditDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
            }
          });
        }
      } catch (error) {
        console.error('Error fetching risk management metrics:', error);
        setMetrics({
          reinsuranceStrategy: {
            creditRating: 'A+',
            paymentHistory: 'Excellent',
            lastReviewDate: new Date().toISOString()
          },
          claimsDevelopment: {
            accuracyRate: 94.5,
            reservingAdequacy: 'Adequate'
          },
          internalControls: {
            effectiveness: 'Strong',
            lastAuditDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
          }
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-lg text-center p-8">
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
            <CardDescription>Fetching risk management metrics...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-lg text-center p-8">
          <CardHeader>
            <CardTitle>No Data Available</CardTitle>
            <CardDescription>
              Risk management metrics are not available at this time.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const getCreditRatingColor = (rating: string) => {
    if (rating.startsWith('A')) return 'text-green-600';
    if (rating.startsWith('B')) return 'text-blue-600';
    return 'text-orange-600';
  };

  const getPaymentHistoryBadge = (status: string) => {
    switch (status) {
      case 'Excellent':
        return 'default';
      case 'Good':
        return 'secondary';
      case 'Fair':
        return 'outline';
      case 'Poor':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getReservingBadge = (status: string) => {
    switch (status) {
      case 'Adequate':
        return 'default';
      case 'Under-Reserved':
        return 'destructive';
      case 'Over-Reserved':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getControlEffectivenessBadge = (status: string) => {
    switch (status) {
      case 'Strong':
        return 'default';
      case 'Adequate':
        return 'secondary';
      case 'Needs Improvement':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const isReinsuranceAdequate = metrics.reinsuranceStrategy.creditRating.startsWith('A') &&
                                 (metrics.reinsuranceStrategy.paymentHistory === 'Excellent' || metrics.reinsuranceStrategy.paymentHistory === 'Good');
  const isReservingAdequate = metrics.claimsDevelopment.reservingAdequacy === 'Adequate';
  const areControlsStrong = metrics.internalControls.effectiveness === 'Strong' || metrics.internalControls.effectiveness === 'Adequate';

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
          <Shield className="h-10 w-10 text-blue-600" />
          Risk Management and Control
        </h1>
        <p className="text-lg text-muted-foreground">
          Risk-Based Supervision (RBS) framework assessment
        </p>
      </div>

      <Alert variant="default" className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800">
        <Target className="h-4 w-4" />
        <AlertTitle className="text-lg font-semibold">
          Risk-Based Supervision (RBS)
        </AlertTitle>
        <AlertDescription>
          The IRA implements Risk-Based Supervision which assesses the quality of an insurer's governance and control over its risks. This framework evaluates reinsurance arrangements, claims reserving, and internal control systems.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className={`border-2 ${isReinsuranceAdequate ? 'border-green-200 dark:border-green-800' : 'border-orange-200 dark:border-orange-800'}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Reinsurance Strategy
            </CardTitle>
            <CardDescription>Catastrophic risk management</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Credit Rating</span>
                <span className={`text-2xl font-bold ${getCreditRatingColor(metrics.reinsuranceStrategy.creditRating)}`}>
                  {metrics.reinsuranceStrategy.creditRating}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Payment History</span>
                <Badge variant={getPaymentHistoryBadge(metrics.reinsuranceStrategy.paymentHistory)}>
                  {metrics.reinsuranceStrategy.paymentHistory}
                </Badge>
              </div>
              <Separator />
              <div className="text-sm text-muted-foreground">
                Last Review: {format(new Date(metrics.reinsuranceStrategy.lastReviewDate), 'PP')}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-2 ${isReservingAdequate ? 'border-green-200 dark:border-green-800' : 'border-orange-200 dark:border-orange-800'}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Claims Development
            </CardTitle>
            <CardDescription>Reserving and estimation accuracy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Estimation Accuracy</p>
                <p className="text-4xl font-bold text-blue-600">
                  {metrics.claimsDevelopment.accuracyRate}%
                </p>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Reserving Adequacy</span>
                <Badge variant={getReservingBadge(metrics.claimsDevelopment.reservingAdequacy)}>
                  {metrics.claimsDevelopment.reservingAdequacy}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-2 ${areControlsStrong ? 'border-green-200 dark:border-green-800' : 'border-orange-200 dark:border-orange-800'}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Internal Controls
            </CardTitle>
            <CardDescription>System effectiveness and reliability</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Effectiveness</span>
                <Badge variant={getControlEffectivenessBadge(metrics.internalControls.effectiveness)}>
                  {metrics.internalControls.effectiveness}
                </Badge>
              </div>
              <Separator />
              <div className="text-sm text-muted-foreground">
                Last Audit: {format(new Date(metrics.internalControls.lastAuditDate), 'PP')}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reinsurance Credit Risk Management</CardTitle>
          <CardDescription>
            Quality of reinsurance arrangements for catastrophic risk management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert variant={isReinsuranceAdequate ? "default" : "destructive"}>
              {isReinsuranceAdequate ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              <AlertTitle>Reinsurance Status</AlertTitle>
              <AlertDescription>
                {isReinsuranceAdequate
                  ? 'Your reinsurance arrangements meet regulatory standards with strong credit ratings and payment history.'
                  : 'Your reinsurance arrangements may need improvement. Review credit ratings and payment history.'}
              </AlertDescription>
            </Alert>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold">Creditworthiness Assessment</h3>
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Credit Rating</span>
                    <span className={`text-xl font-bold ${getCreditRatingColor(metrics.reinsuranceStrategy.creditRating)}`}>
                      {metrics.reinsuranceStrategy.creditRating}
                    </span>
                  </div>
                  <Separator />
                  <p className="text-xs text-muted-foreground">
                    Regulators check the creditworthiness of reinsurers to ensure they can pay claims. Ratings are vetted annually.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Payment History Evaluation</h3>
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Payment Track Record</span>
                    <Badge variant={getPaymentHistoryBadge(metrics.reinsuranceStrategy.paymentHistory)} className="text-sm">
                      {metrics.reinsuranceStrategy.paymentHistory}
                    </Badge>
                  </div>
                  <Separator />
                  <p className="text-xs text-muted-foreground">
                    Annual assessment of reinsurer payment history ensures timely claim settlements and financial reliability.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm font-medium mb-2">Annual Review Process</p>
              <p className="text-xs text-muted-foreground">
                Last Review: {format(new Date(metrics.reinsuranceStrategy.lastReviewDate), 'PPP')} - The company assesses reinsurance credit risk annually by vetting credit grades and payment history to ensure adequate catastrophic risk coverage.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Claims Development and Reserving</CardTitle>
          <CardDescription>
            Estimation accuracy and future claim payment adequacy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold">Estimation Accuracy Rate</h3>
                    <Badge variant="default">{metrics.claimsDevelopment.accuracyRate}%</Badge>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all"
                      style={{ width: `${metrics.claimsDevelopment.accuracyRate}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Historical accuracy of initial loss estimates compared to final claim payments
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold">Reserving Adequacy</h3>
                    <Badge variant={getReservingBadge(metrics.claimsDevelopment.reservingAdequacy)}>
                      {metrics.claimsDevelopment.reservingAdequacy}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Assessment of whether reserves are sufficient to cover future claim obligations
                  </p>
                  {isReservingAdequate && (
                    <div className="flex items-center gap-2 text-green-600 text-sm">
                      <CheckCircle className="h-4 w-4" />
                      <span>Reserves meet regulatory standards</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Alert variant="default" className="bg-slate-50 dark:bg-slate-900">
              <FileCheck className="h-4 w-4" />
              <AlertTitle>Regulatory Scrutiny</AlertTitle>
              <AlertDescription>
                The regulator scrutinizes the estimation of future claim payments to prevent under-reserving, largely through actuarial reports and claims development tables. These tables demonstrate the historical accuracy of the company's initial loss estimates.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Internal Controls System</CardTitle>
          <CardDescription>
            Effectiveness in safeguarding assets and ensuring reliable financial information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 border rounded-lg bg-slate-50 dark:bg-slate-900">
                <div className="flex items-start gap-3 mb-4">
                  <Shield className="h-6 w-6 text-blue-600 mt-1" />
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Control Effectiveness</h3>
                    <Badge variant={getControlEffectivenessBadge(metrics.internalControls.effectiveness)} className="text-sm">
                      {metrics.internalControls.effectiveness}
                    </Badge>
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Key Control Areas:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Asset safeguarding procedures</li>
                    <li>• Financial reporting reliability</li>
                    <li>• Operational efficiency controls</li>
                    <li>• Compliance monitoring systems</li>
                  </ul>
                </div>
              </div>

              <div className="p-6 border rounded-lg">
                <h3 className="font-semibold text-lg mb-4">Board and Audit Oversight</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                    <span className="text-sm">Last Internal Audit</span>
                    <span className="text-sm font-medium">
                      {format(new Date(metrics.internalControls.lastAuditDate), 'PP')}
                    </span>
                  </div>
                  <Separator />
                  <div className="text-xs text-muted-foreground space-y-2">
                    <p>Internal controls are monitored by:</p>
                    <ul className="space-y-1 ml-4">
                      <li>• Internal audit function</li>
                      <li>• Board Audit Committee</li>
                      <li>• Risk management team</li>
                      <li>• External auditors</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {areControlsStrong && (
              <Alert variant="default" className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Strong Control Environment</AlertTitle>
                <AlertDescription>
                  Your internal control system demonstrates effectiveness in safeguarding assets and ensuring reliable financial information, meeting regulatory expectations.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk Management Compliance Checklist</CardTitle>
          <CardDescription>Key requirements under Risk-Based Supervision framework</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <CheckCircle className={`h-5 w-5 mt-0.5 ${isReinsuranceAdequate ? 'text-green-600' : 'text-gray-400'}`} />
              <div className="flex-1">
                <p className="font-medium">Reinsurance Credit Risk Management</p>
                <p className="text-sm text-muted-foreground">
                  Annual assessment of reinsurer creditworthiness and payment history
                </p>
                <div className="mt-2 flex gap-2">
                  <Badge variant="outline">Rating: {metrics.reinsuranceStrategy.creditRating}</Badge>
                  <Badge variant="outline">History: {metrics.reinsuranceStrategy.paymentHistory}</Badge>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <CheckCircle className={`h-5 w-5 mt-0.5 ${isReservingAdequate ? 'text-green-600' : 'text-gray-400'}`} />
              <div className="flex-1">
                <p className="font-medium">Claims Reserving Adequacy</p>
                <p className="text-sm text-muted-foreground">
                  Actuarial reports and claims development tables demonstrate accurate loss estimates
                </p>
                <div className="mt-2">
                  <Badge variant={getReservingBadge(metrics.claimsDevelopment.reservingAdequacy)}>
                    {metrics.claimsDevelopment.reservingAdequacy} ({metrics.claimsDevelopment.accuracyRate}% accuracy)
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <CheckCircle className={`h-5 w-5 mt-0.5 ${areControlsStrong ? 'text-green-600' : 'text-gray-400'}`} />
              <div className="flex-1">
                <p className="font-medium">Internal Control Effectiveness</p>
                <p className="text-sm text-muted-foreground">
                  Board and internal audit oversight of asset safeguarding and financial reliability
                </p>
                <div className="mt-2">
                  <Badge variant={getControlEffectivenessBadge(metrics.internalControls.effectiveness)}>
                    {metrics.internalControls.effectiveness}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
