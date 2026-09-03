import { prisma } from '@/lib/prisma';

export async function deleteGroupPermanently(groupId: string): Promise<void> {
  await prisma.$transaction([
    prisma.mealPrompt.deleteMany({ where: { groupId } }),
    prisma.paymentStatus.deleteMany({ where: { groupId } }),
    prisma.expenseComment.deleteMany({ where: { groupId } }),
    prisma.expenseEntry.deleteMany({ where: { groupId } }),
    prisma.expenseHistory.deleteMany({ where: { groupId } }),
    prisma.expenseCategory.deleteMany({ where: { groupId } }),
    prisma.mealEntry.deleteMany({ where: { groupId } }),
    prisma.mealPlan.deleteMany({ where: { groupId } }),
    prisma.mealEditWindow.deleteMany({ where: { groupId } }),
    prisma.mealChangeRequest.deleteMany({ where: { groupId } }),
    prisma.monthClosing.deleteMany({ where: { groupId } }),
    prisma.comment.deleteMany({ where: { groupId } }),
    prisma.notification.deleteMany({ where: { groupId } }),
    prisma.invitation.deleteMany({ where: { groupId } }),
    prisma.groupOrder.deleteMany({ where: { groupId } }),
    prisma.bazarDutyDay.deleteMany({ where: { schedule: { groupId } } }),
    prisma.bazarSchedule.deleteMany({ where: { groupId } }),
    prisma.membership.deleteMany({ where: { groupId } }),
    prisma.groupSupervisor.deleteMany({ where: { groupId } }),
    prisma.group.delete({ where: { id: groupId } })
  ]);
}

export async function deleteUserPermanently(userId: string, email: string): Promise<void> {
  await prisma.$transaction([
    prisma.expenseEntry.updateMany({ where: { payerId: userId }, data: { payerId: null } }),
    prisma.expenseHistory.updateMany({ where: { actorId: userId }, data: { actorId: null } }),
    prisma.monthClosing.updateMany({ where: { closedById: userId }, data: { closedById: null } }),
    prisma.mealChangeRequest.updateMany({ where: { decidedById: userId }, data: { decidedById: null } }),
    prisma.roleRequest.updateMany({ where: { decidedById: userId }, data: { decidedById: null } }),
    prisma.notification.updateMany({ where: { actorId: userId }, data: { actorId: null } }),
    prisma.userPermission.updateMany({ where: { grantedById: userId }, data: { grantedById: null } }),
    prisma.userPermission.deleteMany({ where: { userId } }),
    prisma.mealPrompt.deleteMany({ where: { userId } }),
    prisma.communityMessage.deleteMany({ where: { authorId: userId } }),
    prisma.communityRead.deleteMany({ where: { userId } }),
    prisma.expenseShare.deleteMany({ where: { userId } }),
    prisma.expenseComment.deleteMany({ where: { userId } }),
    prisma.commentReply.deleteMany({ where: { userId } }),
    prisma.comment.deleteMany({ where: { userId } }),
    prisma.paymentStatus.deleteMany({ where: { userId } }),
    prisma.mealEntry.deleteMany({ where: { userId } }),
    prisma.mealPlan.deleteMany({ where: { userId } }),
    prisma.mealEditWindow.deleteMany({ where: { userId } }),
    prisma.mealChangeRequest.deleteMany({ where: { userId } }),
    prisma.closingLine.deleteMany({ where: { userId } }),
    prisma.invitation.deleteMany({ where: { OR: [{ inviteeId: userId }, { invitedById: userId }] } }),
    prisma.roleRequest.deleteMany({ where: { userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.groupOrder.deleteMany({ where: { userId } }),
    prisma.bazarDutyDay.updateMany({ where: { userId }, data: { userId: null } }),
    prisma.membership.deleteMany({ where: { userId } }),
    prisma.groupSupervisor.deleteMany({ where: { OR: [{ userId }, { addedById: userId }] } }),
    prisma.passwordToken.deleteMany({ where: { userId } }),
    prisma.userSession.deleteMany({ where: { userId } }),
    prisma.loginAttempt.deleteMany({ where: { email } }),
    prisma.user.delete({ where: { id: userId } })
  ]);
}
